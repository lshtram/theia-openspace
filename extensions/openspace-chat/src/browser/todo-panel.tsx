import * as React from '@theia/core/shared/react';

interface TodoItem {
    id: string;
    description: string;
    status: string;
}

interface TodoPanelProps {
    todos: TodoItem[];
}

export const TodoPanel: React.FC<TodoPanelProps> = ({ todos }) => {
    if (!todos || todos.length === 0) { return null; }
    return (
        <div className="openspace-todo-panel" data-testid="todo-panel">
            <div className="todo-panel-header">Todos</div>
            <ul className="todo-list">
                {todos.map(todo => (
                    <li key={todo.id} className={`todo-item todo-status-${todo.status}`}>
                        <span className="todo-status-icon">
                            {todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○'}
                        </span>
                        <span className="todo-description">{todo.description}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
