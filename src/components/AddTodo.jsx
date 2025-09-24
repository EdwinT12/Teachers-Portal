import { memo } from "react";
import { useFormik } from "formik";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { todoValidationSchema } from "../utils/validation";

const AddTodo = ({ addTodo }) => {
  const formik = useFormik({
    initialValues: {
      todo: "",
    },
    validationSchema: todoValidationSchema,
    onSubmit: (values, { resetForm }) => {
      addTodo(values.todo);
      resetForm();
    },
  });

  const helperText =
    formik.touched.todo && formik.errors.todo
      ? formik.errors.todo
      : "Todo task details";

  return (
    <form onSubmit={formik.handleSubmit}>
      <Stack
        direction="column"
        spacing={2}
        sx={{
          justifyContent: "center",
          alignItems: "stretch",
        }}
        style={{
          marginBottom: "10px",
        }}
      >
        <TextField
          fullWidth
          id="todo"
          name="todo"
          label="Todo Task"
          value={formik.values.todo}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.todo && Boolean(formik.errors.todo)}
          helperText={helperText}
          size="small"
        />

        <Button color="white" variant="outlined" fullWidth type="submit">
          Add Todo
        </Button>
      </Stack>
    </form>
  );
};

export default memo(AddTodo);
