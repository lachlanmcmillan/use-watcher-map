# useWatcherMap

Fine-grained state updates in React without signals. WatcherMap uses path subscriptions to ensure components re-render only when relevant data changes.

## Examples

This repository contains a simple example application (`example/`) demonstrating the usage of WatcherMap. You can switch between different scenarios using the tabs:

-   **Simple**: Basic usage demonstration.
-   **SubPath**: Demonstrates watching specific sub-paths within the state.
-   **SubPath Arrays**: Shows how to handle arrays within watched sub-paths.

## Running the Example

1.  Navigate to the `example` directory:
    ```bash
    cd example
    ```
2.  Install dependencies:
    ```bash
    bun install
    ```
3.  Run the example
    ```bash
    bun dev
    ```

