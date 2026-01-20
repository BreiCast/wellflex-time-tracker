import { Resend } from 'resend'

// Initialize Resend only if API key is available
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  return new Resend(apiKey)
}

const ADMIN_EMAILS = [
  'breider@wellflex.co',
  'breidercastro@icloud.com'
]

export async function sendRequestNotificationEmail(
  requestType: string,
  userName: string,
  userEmail: string,
  teamName: string,
  description: string,
  requestedDateFrom?: string,
  requestedDateTo?: string,
  requestedTimeFrom?: string,
  requestedTimeTo?: string
) {
  console.log('[EMAIL] Starting notification email send', {
    requestType,
    userName,
    userEmail,
    teamName,
    hasApiKey: !!process.env.RESEND_API_KEY
  })
  
  const resend = getResendClient()
  if (!resend) {
    console.error('[EMAIL] RESEND_API_KEY not configured, skipping email notification')
    return
  }

  const timeInfo = requestedTimeFrom && requestedTimeTo
    ? `${requestedTimeFrom} - ${requestedTimeTo}`
    : requestedTimeFrom || requestedTimeTo || null

  let dateInfo = 'N/A'
  if (requestedDateFrom && requestedDateTo) {
    const fromDate = new Date(requestedDateFrom + 'T00:00:00')
    const toDate = new Date(requestedDateTo + 'T00:00:00')
    const fromStr = fromDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: fromDate.getFullYear() !== toDate.getFullYear() ? 'numeric' : undefined 
    })
    const toStr = toDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    dateInfo = fromDate.getTime() === toDate.getTime() ? fromStr : `${fromStr} - ${toStr}`
  } else if (requestedDateFrom) {
    dateInfo = new Date(requestedDateFrom + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const subject = `New ${requestType} Request from ${userName}`
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Request Notification</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Request Submitted</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">A new request has been submitted and requires your review.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057; width: 140px;">Request Type:</td>
                <td style="padding: 8px 0; color: #212529;">${requestType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Submitted By:</td>
                <td style="padding: 8px 0; color: #212529;">${userName} (${userEmail})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Team:</td>
                <td style="padding: 8px 0; color: #212529;">${teamName}</td>
              </tr>
              ${dateInfo !== 'N/A' ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Date Range:</td>
                <td style="padding: 8px 0; color: #212529;">${dateInfo}</td>
              </tr>
              ` : ''}
              ${timeInfo ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Time Range:</td>
                <td style="padding: 8px 0; color: #212529;">${timeInfo}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; font-weight: bold; color: #495057; margin-bottom: 8px;">Description:</p>
            <p style="margin: 0; color: #212529; white-space: pre-wrap;">${description}</p>
          </div>
          
          <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
            Please review this request in the admin panel.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated notification from Time Tracker - Wellflex</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
New Request Submitted

A new request has been submitted and requires your review.

Request Type: ${requestType}
Submitted By: ${userName} (${userEmail})
Team: ${teamName}
${dateInfo !== 'N/A' ? `Date Range: ${dateInfo}` : ''}
${timeInfo ? `Time Range: ${timeInfo}` : ''}

Description:
${description}

Please review this request in the admin panel.
  `.trim()

  try {
    // Send to all admin emails
    const emailPromises = ADMIN_EMAILS.map(email =>
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Time Tracker <noreply@wellflex.co>',
        to: email,
        subject,
        html: htmlContent,
        text: textContent,
      })
    )

    const results = await Promise.all(emailPromises)
    console.log('[EMAIL] ✅ Notification emails sent successfully', {
      sent: results.length,
      emails: ADMIN_EMAILS,
      results: results.map((r: any) => ({ id: r?.id, to: r?.to }))
    })
  } catch (error: any) {
    console.error('[EMAIL] ❌ Failed to send request notification email:', {
      error: error?.message || error,
      stack: error?.stack,
      response: error?.response,
      code: error?.code
    })
    // Don't throw - we don't want email failures to break request creation
  }
}

export async function sendRequestConfirmationEmail(
  requestType: string,
  userName: string,
  userEmail: string,
  teamName: string,
  description: string,
  requestedDateFrom?: string,
  requestedDateTo?: string,
  requestedTimeFrom?: string,
  requestedTimeTo?: string
) {
  console.log('[EMAIL] Starting confirmation email send', {
    requestType,
    userName,
    userEmail,
    teamName,
    hasApiKey: !!process.env.RESEND_API_KEY
  })
  
  const resend = getResendClient()
  if (!resend) {
    console.error('[EMAIL] RESEND_API_KEY not configured, skipping confirmation email')
    return
  }

  const timeInfo = requestedTimeFrom && requestedTimeTo
    ? `${requestedTimeFrom} - ${requestedTimeTo}`
    : requestedTimeFrom || requestedTimeTo || null

  let dateInfo = 'N/A'
  if (requestedDateFrom && requestedDateTo) {
    const fromDate = new Date(requestedDateFrom + 'T00:00:00')
    const toDate = new Date(requestedDateTo + 'T00:00:00')
    const fromStr = fromDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: fromDate.getFullYear() !== toDate.getFullYear() ? 'numeric' : undefined 
    })
    const toStr = toDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    dateInfo = fromDate.getTime() === toDate.getTime() ? fromStr : `${fromStr} - ${toStr}`
  } else if (requestedDateFrom) {
    dateInfo = new Date(requestedDateFrom + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const subject = `Your ${requestType} Request Has Been Submitted`
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Request Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Request Submitted Successfully</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
          
          <p style="font-size: 16px;">Thank you for submitting your request. We've received it and it's now pending review by an administrator.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057; width: 140px;">Request Type:</td>
                <td style="padding: 8px 0; color: #212529;">${requestType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Team:</td>
                <td style="padding: 8px 0; color: #212529;">${teamName}</td>
              </tr>
              ${dateInfo !== 'N/A' ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Date Range:</td>
                <td style="padding: 8px 0; color: #212529;">${dateInfo}</td>
              </tr>
              ` : ''}
              ${timeInfo ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Time Range:</td>
                <td style="padding: 8px 0; color: #212529;">${timeInfo}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; font-weight: bold; color: #495057; margin-bottom: 8px;">Your Description:</p>
            <p style="margin: 0; color: #212529; white-space: pre-wrap;">${description}</p>
          </div>
          
          <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
            <p style="margin: 0; font-size: 14px; color: #1976D2;">
              <strong>Status:</strong> Pending Review
            </p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #1976D2;">
              You'll receive another email once your request has been reviewed.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
            If you have any questions, please contact your team administrator.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated confirmation from Time Tracker - Wellflex</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
Request Submitted Successfully

Hi ${userName},

Thank you for submitting your request. We've received it and it's now pending review by an administrator.

Request Type: ${requestType}
Team: ${teamName}
${dateInfo !== 'N/A' ? `Date Range: ${dateInfo}` : ''}
${timeInfo ? `Time Range: ${timeInfo}` : ''}

Your Description:
${description}

Status: Pending Review
You'll receive another email once your request has been reviewed.

If you have any questions, please contact your team administrator.
  `.trim()

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Time Tracker <noreply@wellflex.co>',
      to: userEmail,
      subject,
      html: htmlContent,
      text: textContent,
    })
    console.log('[EMAIL] ✅ Confirmation email sent successfully to requester', {
      email: userEmail,
      resultId: result?.id,
      result: result
    })
  } catch (error: any) {
    console.error('[EMAIL] ❌ Failed to send request confirmation email:', {
      error: error?.message || error,
      stack: error?.stack,
      response: error?.response,
      code: error?.code,
      email: userEmail
    })
    // Don't throw - we don't want email failures to break request creation
  }
}
