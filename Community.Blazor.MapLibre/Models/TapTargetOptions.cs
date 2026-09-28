using System.Text.Json.Serialization;

namespace Community.Blazor.MapLibre.Models;

/// <summary>Options for <see cref="MapLibre.QueryTapTargets"/>, in screen pixels.</summary>
public class TapTargetOptions
{
    [JsonPropertyName("layers")]
    public required IEnumerable<string> Layers { get; set; }

    /// <summary>Half the side of the square around the tap in which points, lines and small areas are hit.</summary>
    [JsonPropertyName("reachTolerance")]
    public double ReachTolerance { get; set; } = 22;

    /// <summary>When several points are within reach, those this close win.</summary>
    [JsonPropertyName("underFingerTolerance")]
    public double UnderFingerTolerance { get; set; } = 10;

    /// <summary>An area no wider or taller than this is hit like a point.</summary>
    [JsonPropertyName("smallAreaSize")]
    public double SmallAreaSize { get; set; } = 44;
}
