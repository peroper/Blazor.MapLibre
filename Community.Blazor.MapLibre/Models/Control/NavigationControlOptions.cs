using System.Text.Json.Serialization;

namespace Community.Blazor.MapLibre.Models.Control;

public class NavigationControlOptions
{
    [JsonPropertyName("visualizePitch")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? VisualizePitch { get; set; }
    
    [JsonPropertyName("visualizeRoll")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? VisualizeRoll { get; set; }
    
    [JsonPropertyName("showZoom")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ShowZoom { get; set; }
    
    [JsonPropertyName("showCompass")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ShowCompass { get; set; }
}
