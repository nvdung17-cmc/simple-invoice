import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useId, type ReactNode } from 'react'

/** A titled card. It is a labelled `section`, so screen-reader users can jump from card to card. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <Card component="section" variant="outlined" aria-labelledby={titleId} sx={{ height: '100%' }}>
      <CardContent>
        <Typography id={titleId} variant="h6" component="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}
