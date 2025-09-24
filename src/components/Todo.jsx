import { memo } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import { useFormik } from "formik";

import { useAuth } from "../hooks/useAuth";
import { todoValidationSchema } from "../utils/validation";

const Todo = ({ todo, updateTodo, deleteTodo }) => {
  const { user } = useAuth();

  const formik = useFormik({
    initialValues: {
      todo: todo.task,
    },
    validationSchema: todoValidationSchema,
    onSubmit: (values) => {
      updateTodo(todo.id, values.todo);
    },
  });

  const helperText =
    formik.touched.todo && formik.errors.todo
      ? formik.errors.todo
      : "Todo task details";

  const isTodoDisabled = todo.user_id !== user?.id;

  return (
    <form onSubmit={formik.handleSubmit}>
      <TextField
        fullWidth
        id="todo"
        name="todo"
        label="Todo Task"
        disabled={isTodoDisabled}
        value={formik.values.todo}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.todo && Boolean(formik.errors.todo)}
        helperText={helperText}
        size="small"
      />

      <IconButton aria-label="save" disabled={isTodoDisabled} type="submit">
        <SaveIcon />
      </IconButton>

      <IconButton
        aria-label="delete"
        onClick={() => deleteTodo(todo.id)}
        disabled={isTodoDisabled}
      >
        <DeleteIcon />
      </IconButton>
    </form>
  );
};

export default memo(Todo);
