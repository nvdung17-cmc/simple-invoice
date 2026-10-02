import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router'
import { errorMessages, errorStatus } from '../../../api/errors'
import { createInvoice, invoiceKeys } from '../../../api/invoices'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { CURRENCIES } from '../../../lib/currencies'
import { todayIsoDate } from '../../../lib/dates'
import {
  createInvoiceDefaults,
  createInvoiceSchema,
  mapServerErrors,
  toCreateInvoiceRequest,
  type CreateInvoiceFormInput,
  type CreateInvoiceFormOutput,
} from '../schema'
import { FormTextField } from './FormTextField'

const dateLabel = { inputLabel: { shrink: true } }

/**
 * Creates a Draft Invoice with one item (spec §6.3). The form checks what it
 * can; the server computes every total and has the last word. Its answers are
 * shown where the User can act on them: on a field, or above the form.
 */
export function CreateInvoicePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const { control, handleSubmit, setError } = useForm<
    CreateInvoiceFormInput,
    unknown,
    CreateInvoiceFormOutput
  >({
    resolver: zodResolver(createInvoiceSchema),
    mode: 'onTouched',
    defaultValues: createInvoiceDefaults(todayIsoDate()),
  })

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      // Every cached list is now out of date; the new Invoice heads the default list.
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      enqueueSnackbar(`Invoice ${invoice.invoiceNumber} created`, { variant: 'success' })
      navigate('/invoices')
    },
    onError: (error) => {
      const status = errorStatus(error)
      if (status === 409) {
        const [message = 'This invoice number is already in use'] = errorMessages(error)
        setError('invoiceNumber', { message }, { shouldFocus: true })
      } else if (status === 400) {
        const { fieldErrors, formErrors: other } = mapServerErrors(errorMessages(error))
        fieldErrors.forEach(({ name, message }, index) =>
          setError(name, { message }, { shouldFocus: index === 0 }),
        )
        setFormErrors(other)
      } else if (status !== 401) {
        // A 401 means the session expired; AuthProvider already sends the User to sign in.
        setFormErrors(['Could not create the invoice. Please try again.'])
      }
    },
  })

  const onSubmit = (values: CreateInvoiceFormOutput) => {
    setFormErrors([])
    mutation.mutate(toCreateInvoiceRequest(values))
  }

  return (
    <>
      <PageHeader title="New invoice" />
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          {formErrors.length > 0 && (
            <Alert severity="error">
              {formErrors.length === 1 ? (
                formErrors[0]
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {formErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Customer">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="customer.fullname"
                    label="Customer name"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.mobileNumber"
                    label="Mobile number"
                    type="tel"
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.address"
                    label="Address"
                    multiline
                    minRows={2}
                  />
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Invoice details">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="invoiceNumber"
                    label="Invoice number"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="invoiceReference"
                    label="Reference"
                    autoComplete="off"
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormTextField
                      control={control}
                      name="invoiceDate"
                      label="Invoice date"
                      type="date"
                      required
                      slotProps={dateLabel}
                    />
                    <FormTextField
                      control={control}
                      name="dueDate"
                      label="Due date"
                      type="date"
                      required
                      slotProps={dateLabel}
                    />
                  </Stack>
                  <FormTextField control={control} name="currency" label="Currency" select required>
                    {CURRENCIES.map(({ code, symbol }) => (
                      <MenuItem key={code} value={code}>
                        {`${code} (${symbol})`}
                      </MenuItem>
                    ))}
                  </FormTextField>
                  <FormTextField
                    control={control}
                    name="description"
                    label="Description"
                    multiline
                    minRows={2}
                  />
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Item">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="item.name"
                    label="Item name"
                    required
                    autoComplete="off"
                  />
                  <Stack direction="row" spacing={2}>
                    <FormTextField
                      control={control}
                      name="item.quantity"
                      label="Quantity"
                      required
                      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                    />
                    <FormTextField
                      control={control}
                      name="item.rate"
                      label="Rate"
                      required
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    />
                  </Stack>
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Tax & discount">
                <Stack direction="row" spacing={2}>
                  <FormTextField
                    control={control}
                    name="taxRate"
                    label="Tax rate (%)"
                    required
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                  <FormTextField
                    control={control}
                    name="discount"
                    label="Discount"
                    helperText="An amount, not a percentage"
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button component={RouterLink} to="/invoices">
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={mutation.isPending}>
              Create invoice
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  )
}
