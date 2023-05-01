const isAuth = (req, res, next) => {
  if (req.session.isAuth) {
    next();
  } else {
    return res.render("login");
  }
};

module.exports = { isAuth };
