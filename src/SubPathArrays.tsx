import { useRef } from "react";
import "./App.css";
import classes from "./App.module.css";
import { useWatcherMapSubPaths, WatcherMapSubPathsReturn } from "./useWatcherMapSubPaths";
import { RerenderIndicator } from "./RerenderIndicator";

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
  const watcher = useWatcherMapSubPaths<State>({
    todos: [
      { id: 1, text: "Learn React", completed: true, tags: ["frontend", "learning"] },
      { id: 2, text: "Build a project", completed: false, tags: ["coding", "project"] },
      { id: 3, text: "Deploy to production", completed: false, tags: ["devops"] }
    ],
    filter: "all",
    nextId: 4
  });

  const addTodo = () => {
    const newTodoText = prompt("Enter a new todo:") || "New Task";
    const newTodo: TodoItem = {
      id: watcher.getPath("nextId"),
      text: newTodoText,
      completed: false,
      tags: ["new"]
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
    if (newTag === null || newTag.trim() === '') {
      return;
    }
    
    const currentTags = watcher.getPath(`todos.${todoIndex}.tags`);
    const updatedTags = [...currentTags, newTag];
    
    // Update tags array for the specific todo
    watcher.setPath(`todos.${todoIndex}.tags`, updatedTags);
  };

  const removeTag = (todoIndex: number, tagIndex: number) => {
    const currentTags = watcher.getPath(`todos.${todoIndex}.tags`);
    const updatedTags = currentTags.filter((_: string, i: number) => i !== tagIndex);
    
    // Update tags array for the specific todo
    watcher.setPath(`todos.${todoIndex}.tags`, updatedTags);
  };

  const replaceTodo = (index: number, newText: string) => {
    // Use the path directly to update just the text field
    watcher.setPath(`todos.${index}.text`, newText);
  };

  return (
    <div className={classes.exampleContainer}>
      <h2>SubPath Arrays Example</h2>
      
      <WatchingState watcher={watcher} />

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={addTodo}>Add Todo</button>
        <button onClick={() => watcher.setPath("filter", watcher.getPath("filter") === "all" ? "active" : "all")}>
          Toggle Filter: {watcher.getPath("filter")}
        </button>
      </div>

      <TodoList watcher={watcher} onToggle={toggleTodoCompleted} onAddTag={addTag} onRemoveTag={removeTag} onReplace={replaceTodo} />
      
      <h3>Array Path Watching</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <WatchFirstTodo watcher={watcher} />
        <WatchSecondTodoText watcher={watcher} />
        <WatchThirdTodoTags watcher={watcher} />
      </div>
      
      <h3>Array Watchers (check console)</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <ListenToTodos watcher={watcher} />
        <ListenToFirstTodo watcher={watcher} />
        <ListenToSecondTodoTags watcher={watcher} />
      </div>
    </div>
  );
}

const WatchingState = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  const state = watcher.useState();

  return (
    <RerenderIndicator>
      <pre className={classes.stateDisplay}>{JSON.stringify(state, null, 2)}</pre>
    </RerenderIndicator>
  );
};

const TodoList = ({ 
  watcher, 
  onToggle,
  onAddTag,
  onRemoveTag,
  onReplace
}: { 
  watcher: WatcherMapSubPathsReturn<State>,
  onToggle: (index: number) => void,
  onAddTag: (todoIndex: number) => void,
  onRemoveTag: (todoIndex: number, tagIndex: number) => void,
  onReplace: (index: number, newText: string) => void
}) => {
  const todos = watcher.usePath("todos");
  const filter = watcher.usePath("filter");
  
  const filteredTodos = filter === "all" 
    ? todos 
    : todos.filter((todo: TodoItem) => filter === "active" ? !todo.completed : todo.completed);

  const handleTextChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target;
    const newValue = inputEl.value;
    
    // Update as the user types
    onReplace(index, newValue);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
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
          const originalIndex = todos.findIndex((t: TodoItem) => t.id === todo.id);
          return (
            <li key={todo.id} className={todo.completed ? classes.completed : ""} data-index={originalIndex}>
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
              <div className={classes.tags}>
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
                  <span className={classes.tag}>+{todo.tags.length - 3} more</span>
                )}
                <button 
                  className={classes.addTag}
                  onClick={() => onAddTag(originalIndex)}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

// Split ArrayWatcher into individual components

const WatchFirstTodo = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Watch a specific todo
  const firstTodo = watcher.usePath("todos.0");
  
  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("todos.0")`}</span>
        <span className={classes.value}>{JSON.stringify(firstTodo, null, 2)}</span>
      </div>
    </RerenderIndicator>
  );
};

const WatchSecondTodoText = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Watch a specific property of a specific todo
  const secondTodoText = watcher.usePath("todos.1.text");
  
  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("todos.1.text")`}</span>
        <span className={classes.value}>{secondTodoText}</span>
      </div>
    </RerenderIndicator>
  );
};

const WatchThirdTodoTags = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Watch a nested array within a todo
  const thirdTodoTags = watcher.usePath("todos.2.tags");
  
  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.usePath("todos.2.tags")`}</span>
        <span className={classes.value}>{JSON.stringify(thirdTodoTags, null, 2)}</span>
      </div>
    </RerenderIndicator>
  );
};

// Split ListeningTodos into individual components

const ListenToTodos = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Listen for changes to the todos array
  watcher.watchPath("todos", (value) => {
    console.log(`Todos updated, new length: ${value.length}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchPath("todos", (value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};

const ListenToFirstTodo = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Listen for changes to a specific todo
  watcher.watchPath("todos.0", (value) => {
    console.log(`First todo updated: ${JSON.stringify(value)}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchPath("todos.0", (value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};

const ListenToSecondTodoTags = ({ watcher }: { watcher: WatcherMapSubPathsReturn<State> }) => {
  // Listen for changes to tags of a specific todo
  watcher.watchPath("todos.1.tags", (value) => {
    console.log(`Second todo tags updated: ${JSON.stringify(value)}`);
  });

  return (
    <RerenderIndicator>
      <div className={classes.displayRow}>
        <span>{`watcher.watchPath("todos.1.tags", (value) => { ... })`}</span>
      </div>
    </RerenderIndicator>
  );
};