import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

type FormTextFieldProps<TValues extends FieldValues, TTransformed> = Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  name: FieldPath<TValues>
  control: Control<TValues, unknown, TTransformed>
}

/**
 * A MUI text field bound to a React Hook Form field. It shows the field's
 * error, and passes the input's ref so the form can focus an invalid field.
 */
export function FormTextField<TValues extends FieldValues, TTransformed = TValues>({
  name,
  control,
  helperText,
  ...props
}: FormTextFieldProps<TValues, TTransformed>) {
  return (
    <Controller
      name={name}
      control={control}
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
