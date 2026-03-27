/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for LovPlan</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>LovPlan</Text>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click the button below to sign in to LovPlan. This link will expire shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Sign In
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Outfit', 'Segoe UI', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#D4952A', letterSpacing: '0.05em', margin: '0 0 32px', fontFamily: "'DM Serif Display', Georgia, serif" }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a17', margin: '0 0 16px', fontFamily: "'DM Serif Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#6b6459', lineHeight: '1.6', margin: '0 0 24px' }
const button = { backgroundColor: '#D4952A', color: '#1a1a17', fontSize: '15px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#a39e94', margin: '32px 0 0' }
