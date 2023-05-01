const validator = require("validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const ejs = require('ejs');
const path = require('path');


const cleanupAndValidate = ({ name, username, email, phone, password }) => {
  return new Promise((resolve, reject) => {
    if (!email || !username || !name || !phone || !password) {
      reject("Missing Credentials");
    }

    if (typeof email !== "string") reject("Invalid Email");
    if (typeof username !== "string") reject("Invalid Username");
    if (typeof password !== "string") reject("Invalid Password");

    if (username.length <= 2 || username.length > 50) {
      reject("username should be 3-50 charachters");
    }

    if (phone.length !== 10) {
      reject("Phone number should have 10 digits");
    }
    if (password.length < 5 || password.length > 20) {
      reject("password should be 5-20 charachters");
    }

    if (!validator.isEmail(email)) {
      reject("Invalid Email Format");
    }

    resolve();
  });
};

const genrateJWTToken = (email) => {
  const token = jwt.sign(email, process.env.JWT_SECRET);
  return token;
};

const sendVerificationToken = async({ token, email, subject, content, requestType }) => {

  var transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: true,
    service: process.env.MAIL_SERVICE,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const link = `http://localhost:7000/api/${requestType}/${token}`;

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: subject,
    html: await ejs.renderFile(path.join(__dirname, '../views/emailTemplate.ejs'), {
      mailContent: `${content}`,
      appName: 'Library Management',
      resetLink: `${link}`,
    })
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent successfully: " + info.response);
    }
  });

  return;
};

module.exports = { cleanupAndValidate, genrateJWTToken, sendVerificationToken };
