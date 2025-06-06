namespace Community.Blazor.MapLibre;

/// <summary>
/// Represents a listener that handles the removal of a registered event listener.
/// </summary>
/// <remarks>
/// The Listener class provides a mechanism to manage the lifecycle of event listeners associated with a MapLibre map object.
/// It ensures that resources tied to the listener, such as JavaScript event handlers, are properly disposed when no longer needed.
/// </remarks>
public class Listener(CallbackHandler action) : IDisposable
{
    public void Dispose()
    {
        _ = Remove();
    }

    public async Task Remove()
    {
        await action.RemoveAsync();
    }
}
