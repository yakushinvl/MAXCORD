const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.API_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"MAXCORD" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Подтверждение регистрации в MAXCORD',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #5865F2; text-align: center;">Добро пожаловать в MAXCORD!</h2>
        <p>Для завершения регистрации, пожалуйста, подтвердите ваш адрес электронной почты, нажав на кнопку ниже:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #5865F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Подтвердить почту</a>
        </div>
        <p>Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:</p>
        <p style="word-break: break-all; color: #5865F2;">${url}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Если вы не регистрировались в MAXCORD, просто проигнорируйте это письмо.</p>
      </div>
    `,
  });
};

const sendLoginCode = async (email, code) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured, login code:', code);
    return; // Proceed without sending email in dev if not configured
  }

  try {
    await transporter.sendMail({
      from: `"MAXCORD" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Код подтверждения входа MAXCORD',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #5865F2; text-align: center;">Код подтверждения</h2>
          <p>Вы пытаетесь войти в свой аккаунт MAXCORD. Используйте следующий код для подтверждения:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5865F2; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${code}</span>
          </div>
          <p>Код действителен в течение 10 минут.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Если это были не вы, немедленно смените пароль.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending login code email:', error);
    throw error; // Re-throw to be caught by the route handler
  }
};

const sendResetCode = async (email, code) => {
  await transporter.sendMail({
    from: `"MAXCORD" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Код для сброса пароля MAXCORD',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #5865F2; text-align: center;">Сброс пароля</h2>
        <p>Вы запросили сброс пароля для вашего аккаунта MAXCORD. Используйте следующий код для подтверждения:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5865F2; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${code}</span>
        </div>
        <p>Код действителен в течение 10 минут.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
      </div>
    `,
  });
};

const sendRegistrationCode = async (email, code) => {
  await transporter.sendMail({
    from: `"MAXCORD" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Код регистрации в MAXCORD',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #5865F2; text-align: center;">Код регистрации</h2>
        <p>Для завершения регистрации в MAXCORD, пожалуйста, введите следующий код:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5865F2; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${code}</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Если это были не вы, проигнорируйте это письмо.</p>
      </div>
    `,
  });
};

const sendEmailChangeCode = async (email, code) => {
  await transporter.sendMail({
    from: `"MAXCORD" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Код подтверждения смены почты MAXCORD',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #5865F2; text-align: center;">Смена почты</h2>
        <p>Вы пытаетесь привязать эту почту к вашему аккаунту MAXCORD. Используйте следующий код:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5865F2; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${code}</span>
        </div>
        <p>Код действителен в течение 10 минут.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Если вы не запрашивали смену почты, немедленно смените пароль.</p>
      </div>
    `,
  });
};

module.exports = {
  sendVerificationEmail,
  sendLoginCode,
  sendResetCode,
  sendRegistrationCode,
  sendEmailChangeCode,
};
