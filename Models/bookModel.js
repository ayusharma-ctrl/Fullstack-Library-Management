const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookSchema = new Schema({
  bookTitle: {
    type: String,
    require: true,
  },
  bookAuthor: {
    type: String,
    require: true,
  },
  bookPrice: {
    type: Number,
    require: true,
  },
  bookCategory: {
    type: String,
    require: true,
  },
  username: {
    type: String,
    require: true,
  },
});

module.exports = mongoose.model("book", bookSchema);
