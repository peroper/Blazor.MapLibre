using System.Text.Json.Serialization;

namespace Community.Blazor.MapLibre.Models.Control;

public class GeolocateControlOptions
{
    [JsonPropertyName("positionOptions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PositionOptions? PositionOptions { get; set; }
    
    [JsonPropertyName("trackUserLocation")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? TrackUserLocation { get; set; }
    
    [JsonPropertyName("showAccuracyCircle")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ShowAccuracyCircle { get; set; }
    
    [JsonPropertyName("showUserLocation")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ShowUserLocation { get; set; }
}

public class PositionOptions
{
    [JsonPropertyName("maximumAge")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? MaximumAge { get; set; }
    
    [JsonPropertyName("timeout")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? Timeout { get; set; }
    
    [JsonPropertyName("enableHighAccuracy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? EnableHighAccuracy { get; set; }
}
