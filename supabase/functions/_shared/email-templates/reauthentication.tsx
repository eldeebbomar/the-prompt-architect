/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for LovPlan</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>LovPlan</Text>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Outfit', 'Segoe UI', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#D4952A', letterSpacing: '0.05em', margin: '0 0 32px', fontFamily: "'DM Serif Display', Georgia, serif" }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a17', margin: '0 0 16px', fontFamily: "'DM Serif Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#6b6459', lineHeight: '1.6', margin: '0 0 24px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#D4952A', margin: '0 0 30px', letterSpacing: '0.1em' }
const footer = { fontSize: '12px', color: '#a39e94', margin: '32px 0 0' }
