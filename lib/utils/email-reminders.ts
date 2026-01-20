import nodemailer from 'nodemailer'

interface ReminderEmailParams {
  userEmail: string
  userName: string
  notificationType: 'CLOCK_IN_REMINDER' | 'CLOCK_OUT_REMINDER' | 'BREAK_RETURN_REMINDER' | 'MISSED_PUNCH_REMINDER'
  sessionInfo: {
    clockInAt?: string
    durationMinutes?: number
    breakStartAt?: string
    breakDurationMinutes?: number
  } | null
  dashboardUrl: string
}

// Create transporter using environment variables
const getEmailTransporter = () => {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD
  const smtpFrom = process.env.SMTP_FROM || 'noreply@wellflex.co'
  const smtpFromName = process.env.SMTP_FROM_NAME || 'wetrack'

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.error('[EMAIL-REMINDERS] SMTP not fully configured')
    return null
  }

  try {
    return nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === '465',
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })
  } catch (error: any) {
    console.error('[EMAIL-REMINDERS] Failed to create transporter:', error)
    return null
  }
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h`
  }
  return `${mins}m`
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export async function sendReminderEmail(params: ReminderEmailParams): Promise<{ success: boolean; error?: string }> {
  const transporter = getEmailTransporter()
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' }
  }

  const { userEmail, userName, notificationType, sessionInfo, dashboardUrl } = params
  const smtpFrom = process.env.SMTP_FROM || 'noreply@wellflex.co'
  const smtpFromName = process.env.SMTP_FROM_NAME || 'wetrack'

  let subject = ''
  let htmlContent = ''
  let textContent = ''

  switch (notificationType) {
    case 'CLOCK_IN_REMINDER':
      subject = '⏰ Time to Clock In - wetrack'
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Time to Clock In</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
              <p>It's time to clock in for your shift. Don't forget to start tracking your time!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Clock In Now</a>
              </div>
            </div>
          </body>
        </html>
      `
      textContent = `Hi ${userName},\n\nIt's time to clock in for your shift. Don't forget to start tracking your time!\n\nClock in: ${dashboardUrl}`
      break

    case 'CLOCK_OUT_REMINDER':
      const duration = sessionInfo?.durationMinutes ? formatDuration(sessionInfo.durationMinutes) : 'N/A'
      const clockInTime = sessionInfo?.clockInAt ? formatTime(sessionInfo.clockInAt) : 'N/A'
      subject = '⏰ Time to Clock Out - wetrack'
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Time to Clock Out</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
              <p>Your scheduled shift is ending. Don't forget to clock out!</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #495057;">Clock In:</td>
                    <td style="padding: 8px 0; color: #212529;">${clockInTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #495057;">Duration:</td>
                    <td style="padding: 8px 0; color: #212529;">${duration}</td>
                  </tr>
                </table>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Clock Out Now</a>
              </div>
            </div>
          </body>
        </html>
      `
      textContent = `Hi ${userName},\n\nYour scheduled shift is ending. Don't forget to clock out!\n\nClock In: ${clockInTime}\nDuration: ${duration}\n\nClock out: ${dashboardUrl}`
      break

    case 'BREAK_RETURN_REMINDER':
      const breakDuration = sessionInfo?.breakDurationMinutes ? formatDuration(sessionInfo.breakDurationMinutes) : 'N/A'
      subject = '⏰ Break Time Reminder - wetrack'
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Break Time Reminder</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
              <p>You've been on break for ${breakDuration}. Don't forget to return and end your break!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">End Break</a>
              </div>
            </div>
          </body>
        </html>
      `
      textContent = `Hi ${userName},\n\nYou've been on break for ${breakDuration}. Don't forget to return and end your break!\n\nEnd break: ${dashboardUrl}`
      break

    case 'MISSED_PUNCH_REMINDER':
      const sessionDuration = sessionInfo?.durationMinutes ? formatDuration(sessionInfo.durationMinutes) : 'N/A'
      const sessionClockIn = sessionInfo?.clockInAt ? formatTime(sessionInfo.clockInAt) : 'N/A'
      subject = '⚠️ Missed Punch Alert - wetrack'
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Missed Punch Alert</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
              <p>You have an active time session that has been running for ${sessionDuration}. Please clock out or submit a time correction request.</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #495057;">Clock In:</td>
                    <td style="padding: 8px 0; color: #212529;">${sessionClockIn}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #495057;">Duration:</td>
                    <td style="padding: 8px 0; color: #212529;">${sessionDuration}</td>
                  </tr>
                </table>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">View Dashboard</a>
                <a href="${dashboardUrl.replace('/tracking', '/dashboard?tab=requests')}" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Request Correction</a>
              </div>
            </div>
          </body>
        </html>
      `
      textContent = `Hi ${userName},\n\nYou have an active time session that has been running for ${sessionDuration}. Please clock out or submit a time correction request.\n\nClock In: ${sessionClockIn}\nDuration: ${sessionDuration}\n\nView dashboard: ${dashboardUrl}\nRequest correction: ${dashboardUrl.replace('/tracking', '/dashboard?tab=requests')}`
      break
  }

  try {
    await transporter.sendMail({
      from: `${smtpFromName} <${smtpFrom}>`,
      to: userEmail,
      subject,
      html: htmlContent,
      text: textContent,
    })

    console.log(`[EMAIL-REMINDERS] ✅ Sent ${notificationType} to ${userEmail}`)
    return { success: true }
  } catch (error: any) {
    console.error(`[EMAIL-REMINDERS] ❌ Failed to send ${notificationType} to ${userEmail}:`, error)
    return { success: false, error: error.message }
  }
}
