import * as yup from "yup";

const todoValidationSchema = yup.object({
  todo: yup
    .string("Enter your todo")
    .min(4, "Mininum 4 characters")
    .required("Todo is required"),
});

export { todoValidationSchema };
