using System.Text.Json.Serialization;

namespace Community.Blazor.MapLibre.Models;

public class TileId(double x, double y, double z)
{
    [JsonPropertyName("x")]
    public double X { get; set; } = x;

    [JsonPropertyName("y")]
    public double Y { get; set; } = y;

    [JsonPropertyName("z")]
    public double Z { get; set; } = z;
}
