"""NetVision Prometheus metrics parsing and capability summaries."""

import re
from typing import Optional

try:
    from services.netvision_client import NetVisionClient
except ImportError:
    from backend.services.netvision_client import NetVisionClient

_METRIC_LINE = re.compile(r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)$")


def _labels(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    out = {}
    for part in raw.split(","):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        out[key.strip()] = value.strip().strip('"')
    return out


def parse_prometheus(text: str) -> dict:
    """Parse a Prometheus exposition into structured metric families."""
    metrics: dict = {}
    help_text: dict = {}
    metric_type: dict = {}
    for line in (text or "").splitlines():
        line = line.strip()
        if line.startswith("# HELP "):
            parts = line[7:].split(None, 1)
            if len(parts) == 2:
                help_text[parts[0]] = parts[1]
            continue
        if line.startswith("# TYPE "):
            parts = line[7:].split()
            if len(parts) == 2:
                metric_type[parts[0]] = parts[1]
            continue
        match = _METRIC_LINE.match(line)
        if not match:
            continue
        name, raw_labels, raw_value = match.groups()
        try:
            value = float(raw_value)
        except ValueError:
            continue
        entry = metrics.setdefault(name, {
            "help": help_text.get(name, ""),
            "type": metric_type.get(name, "untyped"),
            "samples": [],
        })
        entry["samples"].append({"labels": _labels(raw_labels), "value": value})
    return metrics


def _sum(metrics: dict, name: str) -> float:
    return sum(s["value"] for s in metrics.get(name, {}).get("samples", []))


def _latest(metrics: dict, name: str) -> Optional[float]:
    samples = metrics.get(name, {}).get("samples", [])
    return samples[-1]["value"] if samples else None


def summarize(metrics: dict) -> dict:
    """Pick the operational numbers the dashboard actually displays."""
    http_by_path: dict[str, float] = {}
    for sample in metrics.get("netvision_http_requests_total", {}).get("samples", []):
        path = sample["labels"].get("path", "unknown")
        http_by_path[path] = http_by_path.get(path, 0.0) + sample["value"]

    return {
        "metric_families": len(metrics),
        "http_requests_total": _sum(metrics, "netvision_http_requests_total"),
        "http_requests_by_path": dict(sorted(http_by_path.items(), key=lambda kv: -kv[1])[:10]),
        "http_errors": sum(
            s["value"] for s in metrics.get("netvision_http_requests_total", {}).get("samples", [])
            if s["labels"].get("status", "").startswith("5")
        ),
        "scans_total": _sum(metrics, "netvision_scans_total"),
        "scans_in_progress": _latest(metrics, "netvision_scans_in_progress"),
        "scan_duration_sum": _sum(metrics, "netvision_scan_duration_seconds_sum"),
        "devices_found": _sum(metrics, "netvision_scan_devices_found_sum"),
        "devices_up": _latest(metrics, "netvision_health_devices_up"),
        "devices_down": _latest(metrics, "netvision_health_devices_down"),
        "probes_attempts": _sum(metrics, "netvision_probe_attempts_total"),
        "probe_success": _sum(metrics, "netvision_probe_success_total"),
        "capture_packets": _sum(metrics, "netvision_capture_packets_total"),
        "capture_bytes": _sum(metrics, "netvision_capture_bytes_total"),
        "alerts_sent": _sum(metrics, "netvision_alerts_sent_total"),
        "alerts_failed": _sum(metrics, "netvision_alert_failures_total"),
        "process_cpu_seconds": _latest(metrics, "process_cpu_seconds_total"),
        "process_resident_memory_bytes": _latest(metrics, "process_resident_memory_bytes"),
        "process_open_fds": _latest(metrics, "process_open_fds"),
    }


class NetVisionMetricsCollector:
    def __init__(self, client: NetVisionClient):
        self.client = client

    async def snapshot(self, raw: bool = False) -> dict:
        text = await self.client.metrics_raw()
        metrics = parse_prometheus(text)
        result = {
            "reachable": bool(text),
            "summary": summarize(metrics),
        }
        if raw:
            result["metrics"] = metrics
        return result
