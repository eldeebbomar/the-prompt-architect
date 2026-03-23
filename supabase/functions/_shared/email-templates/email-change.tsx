/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for LovPlan</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>LovPlan</Text>
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your email from{' '}
          <Link href={`mailto:${email}`} style={linkStyle}>{email}</Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={linkStyle}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email Change
        </Button>
        <Text style={footer}>
          If you didn't request this change, please secure your account immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Outfit', 'Segoe UI', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#D4952A', letterSpacing: '0.05em', margin: '0 0 32px', fontFamily: "'DM Serif Display', Georgia, serif" }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a17', margin: '0 0 16px', fontFamily: "'DM Serif Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#6b6459', lineHeight: '1.6', margin: '0 0 24px' }
const linkStyle = { color: '#D4952A', textDecoration: 'underline' }
const button = { backgroundColor: '#D4952A', color: '#1a1a17', fontSize: '15px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#a39e94', margin: '32px 0 0' }
