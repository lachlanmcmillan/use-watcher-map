import classes from "./subPathArrays.module.css";
import {
  useWatcherMap,
  WatcherMapReturn,
} from "../../../src/useWatcherMap";
import { RerenderIndicator } from "../../components/RerenderIndicator/RerenderIndicator";
import { DisplayRow } from "../../components/DisplayRow/DisplayRow";

/**
 * SubPathArraysExample - Demonstrates array handling with useWatcherMapSubPaths
 * Shows advanced techniques for managing collections of objects and arrays
 * Includes CRUD operations on nested data structures with path-based access
 * Demonstrates watching arrays, individual array elements, and nested properties
 */

type TodoItem = {
  id: number;
  text: string;
  completed: boolean;
  tags: string[];
};

type State = {
  todos: TodoItem[];
  filter: string;
  nextId: number;
};

export function SubPathArraysExample() {
  const initialState: State = {
    todos: [
      {
        id: 1,
        text: "Learn React",
        completed: true,
        tags: ["frontend", "learning"],
      },
      {
        id: 2,
        text: "Build a project",
        completed: false,
        tags: ["coding", "project"],
      },
      {
        id: 3,
        text: "Deploy to production",
        completed: false,
        tags: ["devops"],
      },
    ],
    filter: "all",
    nextId: 4,
  };

  const watcher = useWatcherMap<State>({ ...initialState });

  const addTodo = () => {
    const newTodoText = prompt("Enter a new todo:");
    if (newTodoText === null) return; // Don't add if cancelled

    const newTodo: TodoItem = {
      id: watcher.getPath("nextId"),
      text: newTodoText || "New Task",
      completed: false,
      tags: ["new"],
    };

    // Add new todo to the array
    const todos = [...watcher.getPath("todos"), newTodo];
    watcher.setPath("todos", todos);

    // Increment nextId
    watcher.setPath("nextId", watcher.getPath("nextId") + 1);
  };

  const toggleTodoCompleted = (index: number) => {
    const path = `todos.${index}.completed`;
    const currentValue = watcher.getPath(path);
    watcher.setPath(path, !currentValue);
  };

  const addTag = (todoIndex: number) => {
    const newTag = prompt("Enter a new tag:");

    // If user cancels (returns null) or enters empty string, don't add a tag
    if (newTag === null || newTag.trim() === "") {
      return;
    }

    const currentTags = watcher.getPath(`todos.${todoIndex}.tags`);
    const updatedTags = [...currentTags, newTag];

    // Update tags array for the specific todo
    watcher.setPath(`todos.${todoIndex}.tags`, updatedTags);
  };

  const removeTag = (todoIndex: number, tagIndex: number) => {
    const currentTags = watcher.getPath(`todos.${todoIndex}.tags`);
    const updatedTags = currentTags.filter(
      (_: string, i: number) => i !== tagIndex
    );

    // Update tags array for the specific todo
    watcher.setPath(`todos.${todoIndex}.tags`, updatedTags);
  };

  const replaceTodo = (index: number, newText: string) => {
    // Use the path directly to update just the text field
    watcher.setPath(`todos.${index}.text`, newText);
  };

  const deleteTodo = (index: number) => {
    const todos = watcher.getPath("todos");
    const updatedTodos = todos.filter((_: TodoItem, i: number) => i !== index);
    watcher.setPath("todos", updatedTodos);
  };

  const resetState = () => {
    watcher.setState(initialState);
  };

  return (
    <div className={classes.exampleContainer}>
      <h2>SubPath Arrays Example</h2>

      <p className={classes.description}>
        Complex array and nested data operations via paths.
      </p>

      <WatchingState watcher={watcher} />

      <div className={classes.buttonContainer}>
        <button onClick={addTodo}>Add Todo</button>
        <button
          onClick={() =>
            watcher.setPath(
              "filter",
              watcher.getPath("filter") === "all" ? "active" : "all"
            )
          }
        >
          Toggle Filter: {watcher.getPath("filter")}
        </button>
        <button onClick={resetState}>Reset State</button>
      </div>

      <TodoList
        watcher={watcher}
        onToggle={toggleTodoCompleted}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onReplace={replaceTodo}
        onDelete={deleteTodo}
      />

      <h3>Array Path Watching</h3>
      <div className={classes.watchingContainer}>
        <WatchFirstTodoCompleted watcher={watcher} />
        <WatchFirstTodoTags watcher={watcher} />
        <WatchFirstTodoFirstTag watcher={watcher} />
        <WatchFirstTodo watcher={watcher} />
        <WatchSecondTodoText watcher={watcher} />
        <WatchThirdTodoTags watcher={watcher} />
      </div>

      <h3>Array Watchers (check console)</h3>
      <div className={classes.watchingContainer}>
        <ListenToFirstTodo watcher={watcher} />
        <ListenToFirstTodoCompleted watcher={watcher} />
        <ListenToFirstTodoTags watcher={watcher} />
        <ListenToSecondTodoTags watcher={watcher} />
      </div>
    </div>
  );
}

const WatchingState = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const state = watcher.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </RerenderIndicator>
  );
};

const TodoList = ({
  watcher,
  onToggle,
  onAddTag,
  onRemoveTag,
  onReplace,
  onDelete,
}: {
  watcher: WatcherMapReturn<State>;
  onToggle: (index: number) => void;
  onAddTag: (todoIndex: number) => void;
  onRemoveTag: (todoIndex: number, tagIndex: number) => void;
  onReplace: (index: number, newText: string) => void;
  onDelete: (index: number) => void;
}) => {
  const todos = watcher.usePath("todos");
  const filter = watcher.usePath("filter");

  const filteredTodos =
    filter === "all"
      ? todos
      : todos.filter((todo: TodoItem) =>
          filter === "active" ? !todo.completed : todo.completed
        );

  const handleTextChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputEl = event.target;
    const newValue = inputEl.value;

    // Update as the user types
    onReplace(index, newValue);
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      // Remove focus after pressing Enter
      event.currentTarget.blur();
    }
  };

  return (
    <>
      <h3>Todo List (Filter: {filter})</h3>
      <ul className={classes.todoList}>
        {filteredTodos.map((todo: TodoItem, index: number) => {
          // Find the original index in the full todos array
          const originalIndex = todos.findIndex(
            (t: TodoItem) => t.id === todo.id
          );
          return (
            <li
              key={todo.id}
              className={todo.completed ? classes.completed : ""}
              data-index={originalIndex}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggle(originalIndex)}
              />
              <input
                type="text"
                className={classes.todoText}
                value={todo.text}
                onChange={(e) => handleTextChange(originalIndex, e)}
                onKeyDown={(e) => handleKeyDown(originalIndex, e)}
                placeholder="Todo text"
              />
              <div className={`${classes.tags} ${classes.tagsContainer}`}>
                {todo.tags.slice(0, 3).map((tag: string, tagIndex: number) => (
                  <span key={tagIndex} className={classes.tag}>
                    {tag}
                    <button
                      className={classes.removeTag}
                      onClick={() => onRemoveTag(originalIndex, tagIndex)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {todo.tags.length > 3 && (
                  <span className={classes.tag}>
                    +{todo.tags.length - 3} more
                  </span>
                )}
                <button
                  className={classes.addTag}
                  onClick={() => onAddTag(originalIndex)}
                >
                  +
                </button>
              </div>
              <button
                className={classes.deleteButton}
                onClick={() => onDelete(originalIndex)}
                title="Delete todo"
              >
                🗑️
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

const WatchFirstTodo = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const firstTodo = watcher.usePath("todos.0");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.0")'>
        {JSON.stringify(firstTodo, null, 2)}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchFirstTodoCompleted = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const firstTodoCompleted = watcher.usePath("todos.0.completed");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.0.completed")'>
        {typeof firstTodoCompleted === "boolean"
          ? firstTodoCompleted
            ? "true"
            : "false"
          : null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchFirstTodoTags = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const firstTodoTags = watcher.usePath("todos.0.tags");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.0.tags")'>
        {JSON.stringify(firstTodoTags, null, 2)}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchFirstTodoFirstTag = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const value = watcher.usePath("todos.0.tags.0");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.0.tags.0")'>{value}</DisplayRow>
    </RerenderIndicator>
  );
};

const WatchSecondTodoText = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const secondTodoText = watcher.usePath("todos.1.text");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.1.text")'>
        {secondTodoText}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const WatchThirdTodoTags = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  const thirdTodoTags = watcher.usePath("todos.2.tags");
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.usePath("todos.2.tags")'>
        {JSON.stringify(thirdTodoTags, null, 2)}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListenToFirstTodo = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("todos.0", (value) => {
    console.log(`watcher.watchpath("todos.0") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("todos.0", (value) => { ... })'>
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListenToFirstTodoCompleted = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("todos.0.completed", (value) => {
    console.log(`watcher.watchpath("todos.0.completed") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("todos.0.completed", (value) => { ... })'>
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListenToFirstTodoTags = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("todos.0.tags", (value) => {
    console.log(`watcher.watchpath("todos.0.tags") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("todos.0.tags", (value) => { ... })'>
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};

const ListenToSecondTodoTags = ({
  watcher,
}: {
  watcher: WatcherMapReturn<State>;
}) => {
  watcher.watchPath("todos.1.tags", (value) => {
    console.log(`watcher.watchpath("todos.1.tags") =>`, value);
  });
  return (
    <RerenderIndicator>
      <DisplayRow label='watcher.watchPath("todos.1.tags", (value) => { ... })'>
        {null}
      </DisplayRow>
    </RerenderIndicator>
  );
};
