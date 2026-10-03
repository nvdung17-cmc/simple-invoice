import TextField, { type TextFieldProps } from '@mui/material/TextField'
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form'

type FormTextFieldProps<TValues extends FieldValues, TTransformed> = Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  name: FieldPath<TValues>
  control: Control<TValues, unknown, TTransformed>
  rules?: Pick<RegisterOptions<TValues, FieldPath<TValues>>, 'deps'>
}

/**
 * A MUI text field bound to a React Hook Form field. It shows the field's
 * error, and passes the input's ref so the form can focus an invalid field.
 * `rules.deps` names the fields to check again when this one changes.
 */
export function FormTextField<TValues extends FieldValues, TTransformed = TValues>({
  name,
  control,
  rules,
  helperText,
  ...props
}: FormTextFieldProps<TValues, TTransformed>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { ref, ...field }, fieldState }) => (
        <TextField
          fullWidth
          {...props}
          {...field}
          inputRef={ref}
          error={fieldState.invalid}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  )
}
