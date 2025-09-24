import { useEffect, useState, memo } from "react";
import Stack from "@mui/material/Stack";
import toast from "react-hot-toast";

import { useAuth } from "../hooks/useAuth";
import AddTodo from "./AddTodo";
import supabase from "../utils/supabase";
import Todo from "./Todo";

const Todos = () => {
  const { session, user, loading } = useAuth();
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    getTodos();
  }, []);

  const getTodos = async () => {
    const { data } = await supabase.from("todos_public_view").select();

    setTodos(data?.sort((a, b) => a.id - b.id));
  };

  const addTodo = async (newTodo) => {
    const result = await supabase
      .from("todos")
      .insert([{ user_id: user.id, task: newTodo }]);

    if (result.error) {
      toast.error(result.error?.message);
    } else {
      getTodos();
      toast.success("Todo task added succesfully");
    }
  };

  const deleteTodo = async (id) => {
    const result = await supabase.from("todos").delete().eq("id", id);

    setTodos(todos.filter((todo) => todo.id !== id));

    if (result.error) {
      toast.error(result.error?.message);
    } else {
      toast.success("Todo task deleted succesfully");
    }

    getTodos();
  };

  const updateTodo = async (id, updatedTask) => {
    const result = await supabase
      .from("todos")
      .update({ task: updatedTask })
      .eq("id", id);

    if (result.error) {
      toast.error(result.error?.message);
    } else {
      toast.success("Todo task updated succesfully");
    }

    getTodos();
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {session && <AddTodo addTodo={addTodo} />}
      <br />
      <Stack direction="column">
        {todos?.map((todo) => (
          <Todo
            todo={todo}
            updateTodo={updateTodo}
            key={todo.id}
            deleteTodo={deleteTodo}
          />
        ))}
      </Stack>
    </>
  );
};

export default memo(Todos);
