rule OblivionExampleMarker
{
    meta:
        description = "Example rule — replace with your own indicators"
        author = "GateWay:Oblivion"
    strings:
        $marker = "oblivion-example-ioc"
    condition:
        $marker
}
