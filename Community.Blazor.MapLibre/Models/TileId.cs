using System.Text.Json.Serialization;

namespace Community.Blazor.MapLibre.Models;

public class TileId(uint z, uint x, uint y)
{
    [JsonPropertyName("x")]
    public uint X { get; set; } = x;

    [JsonPropertyName("y")]
    public uint Y { get; set; } = y;

    [JsonPropertyName("z")]
    public uint Z { get; set; } = z;
}
