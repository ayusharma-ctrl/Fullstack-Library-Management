const express = require("express");
const clc = require("cli-color");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const session = require("express-session");
const mongoDbSession = require("connect-mongodb-session")(session);
const jwt = require("jsonwebtoken");
const { config } = require("dotenv");

//file-imports
const {
    cleanupAndValidate,
    genrateJWTToken,
    sendVerificationToken,
} = require("./utils/authUtils");
const userModel = require("./Models/userModel");
const bookModel = require("./Models/bookModel");
const { isAuth } = require("./middlewares/isAuthmiddleware");
const Ratelimiting = require("./middlewares/rateLimiting");

//initializing our server
const app = express();

//setting up config.env file so that we can use content of it
config({
    path: "./config.env"
})

//variables
const store = new mongoDbSession({
    uri: process.env.MONGO_URI,
    collection: "sessions",
});

//middlewares
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: store,
    })
);
app.use(express.static("public"));

//db connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log(clc.blueBright.bold.underline("MongoDb Connected"));
    })
    .catch((error) => {
        console.log(clc.red(error));
    });

//routes
app.get("/", (req, res) => {
    return res.send(`<h2>Welcome to Library Management server.</h2> <p> Routes ---> To Register -> <b>/register</b> , To Login -> <b>/login</b> </p>`);
});

app.get("/register", (req, res) => {
    return res.render("register");
});

app.post("/register", async (req, res) => {
    const { name, username, email, phone, password } = req.body;
    //Data validation
    try {
        await cleanupAndValidate({ name, username, email, phone, password });
    } catch (error) {
        return res.send({
            status: 400,
            message: "Data Error",
            error: error,
        });
    }

    //check is the email exits or not in Db;
    const userObjEmailExits = await userModel.findOne({ email });

    if (userObjEmailExits) {
        return res.send({
            status: 400,
            message: "Email Already Exits",
        });
    }

    //check is the username exits or not in Db;
    const userObjUsernameExits = await userModel.findOne({ username });

    if (userObjUsernameExits) {
        return res.send({
            status: 400,
            message: "Username Already Exits",
        });
    }

    //password hashing
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALTROUNDS));

    //Create userObj
    const userObj = new userModel({
        name: name,
        username: username,
        email: email,
        phone: phone,
        password: hashedPassword,
    });

    //genrate token
    const token = genrateJWTToken(email);

    //Save in Db
    try {
        const userDb = await userObj.save();
        //send token to user
        const subject = `Hello ${name}, verify your account!`;
        const content = `Dear ${name}, thank you for creating a new account. Now it's a time to verify your account.`
        const requestType = "account/verify"
        sendVerificationToken({ token, email, subject, content, requestType });
        console.log("We have sent a mail to your registered email. Please verify your account before login!");
        return res.render("login");
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database Error",
            error: error.message,
        });
    }
});

app.get("/login", (req, res) => {
    return res.render("login");
});

app.post("/login", async (req, res) => {
    //console.log(req.body);
    const { loginId, password } = req.body;
    //Data validation

    if (!loginId || !password) {
        return res.send({
            status: 400,
            message: "Missing credentials",
        });
    }

    if (typeof loginId !== "string" || typeof password !== "string") {
        return res.send({
            status: 400,
            message: "Invalid Data Format",
        });
    }

    //find the user obj from loginId
    let userDb;
    if (validator.isEmail(loginId)) {
        userDb = await userModel.findOne({ email: loginId });
    } else {
        userDb = await userModel.findOne({ username: loginId });
    }
    // console.log(userDb);
    if (!userDb) {
        return res.send({
            status: 400,
            message: "User does not exist, Please register first",
        });
    }
    //eamilAuthenticated or not
    if (userDb.emailAuthenticated === false) {
        return res.send({
            status: 400,
            message: "Please verfiy your email first",
        });
    }

    //compare the password

    const isMatch = await bcrypt.compare(password, userDb.password);
    //   console.log(isMatch);
    if (!isMatch) {
        return res.send({
            status: 400,
            message: "Password incorrect",
        });
    }
    //successfull login

    //   console.log(req.session);
    req.session.isAuth = true;
    req.session.user = {
        username: userDb.name,
        email: userDb.email,
        phone: userDb.phone,
        userId: userDb._id,
    };

    console.log(req.session);

    return res.render("dashboard", { name: userDb.name });
});

// route to render page resendVerifyLink
app.get("/resend-verification", (req, res) => {
    return res.render("resendVerifyLink");
});

//route to resend verification mail
app.post("/resend-verification", async (req, res) => {
    const { loginId } = req.body;

    //Data validation
    if (!loginId) {
        return res.send({
            status: 400,
            message: "Missing email/username",
        });
    }

    if (typeof loginId !== "string") {
        return res.send({
            status: 400,
            message: "Invalid Data Format",
        });
    }

    //find the user obj from loginId
    let userDb;
    if (validator.isEmail(loginId)) {
        userDb = await userModel.findOne({ email: loginId });
    } else {
        userDb = await userModel.findOne({ username: loginId });
    }
    // console.log(userDb);
    if (!userDb) {
        return res.send({
            status: 400,
            message: "User does not exist, Please register first",
        });
    }

    //eamilAuthenticated or not
    if (userDb.emailAuthenticated === true) {
        return res.send({
            status: 400,
            message: "Your account is already verified! Please login.",
        });
    }

    //genrate token
    const token = genrateJWTToken(userDb.email);
    //get user email
    const email = userDb.email;

    try {
        //send token to user
        const subject = `Hello ${userDb.name}, verify your account!`;
        const content = `Dear ${userDb.name}, we have received your request. Now it's a time to verify your account.`
        const requestType = "account/verify"
        sendVerificationToken({ token, email, subject, content, requestType });
        console.log("We have sent a mail to your registered email. Check your mail to verify your account.");
        return res.render("login");
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database Error",
            error: error,
        });
    }

});

// route to render page forgetPassword
app.get("/forget-password", (req, res) => {
    return res.render("forgetPassword");
});

// route to send forget password mail
app.post("/forget-password", async (req, res) => {
    const { loginId } = req.body;

    //Data validation
    if (!loginId) {
        return res.send({
            status: 400,
            message: "Missing email/username",
        });
    }

    if (typeof loginId !== "string") {
        return res.send({
            status: 400,
            message: "Invalid Data Format",
        });
    }

    //find the user obj from loginId
    let userDb;
    if (validator.isEmail(loginId)) {
        userDb = await userModel.findOne({ email: loginId });
    } else {
        userDb = await userModel.findOne({ username: loginId });
    }
    // console.log(userDb);
    if (!userDb) {
        return res.send({
            status: 400,
            message: "User does not exist, Please register first",
        });
    }

    //genrate token
    const token = genrateJWTToken(userDb.email);
    //get user email
    const email = userDb.email;

    try {
        //send token to user
        const subject = `Hello ${userDb.name}, reset your account password!`;
        const content = `Dear ${userDb.name}, we have received your request. Now it's time to reset your account password.`
        const requestType = "reset/password"
        sendVerificationToken({ token, email, subject, content, requestType });
        console.log("We have sent a mail to your registered mail to reset your password.");
        return res.render("login");
    } catch (error) {
        return res.send({
            status: 500,
            message: "Internal Server Error",
            error: error,
        });
    }

});

// route to render page to enter new password
app.get("/api/reset/password/:id", (req, res) => {
    return res.render("newPassword", { id: req.params.id });
});

// route to update user account password
app.post("/api/reset/password/:id", async (req, res) => {
    const { newPassword, confirmPassword } = req.body;

    //Data validation
    if (!newPassword || !confirmPassword) {
        return res.send({
            status: 400,
            message: "Missing credentials!",
        });
    }

    if (newPassword !== confirmPassword) {
        return res.send({
            status: 400,
            message: "New Password and Confirm Password are not matching. Try again!",
        });
    }

    if (newPassword.length < 5 || newPassword.length > 20) {
        return res.send({
            status: 400,
            message: "Password should be 5-20 characters long.",
        });
    }

    // get token
    const token = req.params.id;

    //find user with this token after decoding it
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        try {
            //password hashing
            const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.SALTROUNDS));
            await userModel.findOneAndUpdate(
                { email: decoded },
                { password: hashedPassword }
            );
            console.log("Your password is updated! Click 'OK' to redirect to Login Page.");
            return res.redirect("/login");
        } catch (error) {
            return res.send({
                status: 500,
                message: "Email Authentication Failed",
            });
        }
    });
});


//route to verify account
//http:localhost:8000/api/djflkzdsfnsidfhepqwofhjpoaewfjaqpof
app.get("/api/account/verify/:id", async (req, res) => {
    //   console.log(req.params);
    const token = req.params.id;

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        // console.log(decoded);
        try {
            await userModel.findOneAndUpdate(
                { email: decoded },
                { emailAuthenticated: true }
            );
            console.log("Your account is verified! Click 'OK' to redirect to Login Page.");
            return res.redirect("/login");
        } catch (error) {
            return res.send({
                status: 500,
                message: "Email Authentication Failed",
            });
        }
    });
});


// route to logout
app.post("/logout", isAuth, (req, res) => {
    req.session.destroy((error) => {
        if (error) throw error;
        return res.redirect("/login");
    });
});

// route to render dashboard page
app.get("/dashboard", isAuth, async (req, res) => {
    return res.render("dashboard");
});


//library routes

// route to add a new book 
app.post("/create-item", isAuth, Ratelimiting, async (req, res) => {
    const { bookTitle, bookAuthor, bookPrice, bookCategory } = req.body;
    const username = req.session.user.username;

    //data validation
    if (!bookTitle || !bookAuthor || !bookPrice || !bookCategory) {
        return res.send({
            status: 400,
            message: "Missing credentials",
        });
    }

    if (bookTitle.length < 3 || bookTitle.length > 30) {
        return res.send({
            status: 400,
            message:
                "Title is either small or too large.",
        });
    }

    //intialized todo Schema and store it in Db
    const bookObj = new bookModel({
        bookTitle: bookTitle,
        bookAuthor: bookAuthor,
        bookPrice: bookPrice,
        bookCategory: bookCategory,
        username: username,
    });

    //save in db
    try {
        const bookDb = await bookObj.save();
        return res.send({
            status: 201,
            message: "New Book Created Successfully",
            data: bookDb,
        });
    } catch (error) {
        return res.send({
            status: 500,
            message: "Dabase error",
            error: error,
        });
    }
});

// route to edit book details
app.post("/edit-item", isAuth, Ratelimiting, async (req, res) => {
    const { bookTitle, bookAuthor, bookPrice, bookCategory, id } = req.body;
    const username = req.session.user.username;

    //data validation
    if (!bookTitle || !bookAuthor || !bookPrice || !bookCategory) {
        return res.send({
            status: 400,
            message: "Missing credentials",
        });
    }
    if (bookTitle.length < 3 || bookTitle.length > 50) {
        return res.send({
            status: 400,
            message:
                "Title is either small or too large.",
        });
    }

    //find the book
    const bookDetails = await bookModel.findOne({ _id: id });
    if (!bookDetails) {
        return res.send({
            status: 400,
            message: "Book not found!",
        });
    }
    //check ownership
    if (bookDetails.username !== username) {
        return res.send({
            status: 401,
            message: "Not allowed to edit, authorisation failed",
        });
    }

    try {
        const bookDb = await bookModel.findOneAndUpdate(
            { _id: id },
            {
                bookTitle: bookTitle,
                bookAuthor: bookAuthor,
                bookPrice: bookPrice,
                bookCategory: bookCategory,
            }
        );
        // console.log(todoDb);
        return res.send({
            status: 200,
            message: "Book details updated successfully",
            data: bookDb,
        });
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database error",
            error: error,
        });
    }
});

//delete homework
app.post("/delete-item", isAuth, Ratelimiting, async (req, res) => {
    const { id } = req.body;
    const username = req.session.user.username;

    //find the todo
    const todoDetails = await bookModel.findOne({ _id: id });
    if (!todoDetails) {
        return res.send({
            status: 400,
            message: "book not found",
        });
    }

    //check ownership
    if (todoDetails.username !== username) {
        return res.send({
            status: 401,
            message: "Not allowed to delete, authorisation failed",
        });
    }

    try {
        const bookDb = await bookModel.findOneAndDelete({ _id: id });
        // console.log(todoDb);
        return res.send({
            status: 200,
            message: "book deleted successfully",
            data: bookDb,
        });
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database error",
            error: error,
        });
    }
});

// app.get("/read-item", isAuth, async (req, res) => {
//   //username
//   const username = req.session.user.username;
//   try {
//     const todoDb = await bookModel.find({ username: username });
//     console.log(todoDb);

//     return res.send({ status: 200, message: "Read success", data: todoDb });
//   } catch (error) {
//     return res.send(error);
//   }
// });

// /pagination_dashboard?skip=10

app.get("/pagination_dashboard", isAuth, async (req, res) => {
    const skip = req.query.skip || 0;
    const LIMIT = 5;
    const username = req.session.user.username;

    //aggregate function
    //pagination match
    //which query needs to be performed first?
    try {
        const todos = await bookModel.aggregate([
            { $match: { username: username } },
            {
                $facet: {
                    data: [{ $skip: parseInt(skip) }, { $limit: LIMIT }],
                },
            },
        ]);

        return res.send({
            status: 200,
            message: "Read Success",
            data: todos[0].data,
        });
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database error",
            error: error,
        });
    }
});



app.listen(process.env.PORT, () => {
    console.log(clc.yellow(`Server is running: http://localhost:${process.env.PORT}/`));
});