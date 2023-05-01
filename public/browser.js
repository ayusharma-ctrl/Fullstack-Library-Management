let skip = 0;

window.onload = function () {
  genrateBooks();
};

document.addEventListener("click", function (event) {
  if (event.target.classList.contains("add_item")) {
    // event.preventDefault();
    const bookTitle = document.getElementById("book_title").value;
    const bookAuthor = document.getElementById("book_author").value;
    const bookCategory = document.getElementById("book_category").value;
    const bookPrice = document.getElementById("book_price").value;

    if (bookTitle.value === "" || bookAuthor.value === "" || bookCategory.value === "" || bookPrice.value === "") {
      alert("Please enter all the fields before submitting!");
    }

    axios
      .post("/create-item", { bookTitle: bookTitle, bookAuthor: bookAuthor, bookPrice: bookPrice, bookCategory: bookCategory})
      .then((res) => {
        if (res.data.status !== 201) {
          alert(res.data.message);
          return;
        }
        bookTitle = "";
        bookAuthor = "";
        bookCategory = "";
        bookPrice = "";
        location.reload();
      })
      .catch((err) => {
        alert(err);
      });
  }

  //edit
  else if (event.target.classList.contains("edit-me")) {
    const id = event.target.getAttribute("data-id");
    const bookTitle = document.getElementById("book_title").value;
    const bookAuthor = document.getElementById("book_author").value;
    const bookCategory = document.getElementById("book_category").value;
    const bookPrice = document.getElementById("book_price").value;

    axios
      .post("/edit-item", { bookTitle, bookAuthor, bookPrice, bookCategory, id })
      .then((res) => {
        if (res.data.status !== 200) {
          alert(res.data.message);
          return;
        }
        console.log(res);
        location.reload();
        // event.target.parentElement.parentElement.querySelector(
        //   ".item-text"
        // ).innerHTML = newData;
      })
      .catch((err) => {
        console.log(err);
        alert(err);
      });
  }

  //delete
  else if (event.target.classList.contains("delete-me")) {
    const id = event.target.getAttribute("data-id");

    axios
      .post("/delete-item", { id })
      .then((res) => {
        if (res.data.status !== 200) {
          alert(res.data.message);
          return;
        }
        // event.target.parentElement.parentElement.remove();
        location.reload();
      })
      .catch((err) => {
        console.log(err);
      });
  } 
  
  else if (event.target.classList.contains("show_more")) {
    genrateBooks();
  }
});


function genrateBooks() {
  //axios get, return books

  axios
    .get(`/pagination_dashboard?skip=${skip}`)
    .then((res) => {
      const books = res.data.data;

      document.getElementById("item_list").insertAdjacentHTML(
        "beforeend",
        books
          .map((item) => {
            return `<li class="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
          <span class="item-text">${item.todo}</span>
          <div>
          <button data-id="${item._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
          <button data-id="${item._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
      </div>
      </li>`;
          })
          .join("")
      );

      skip += books.length;
    })
    .catch((err) => {
      console.log(err);
    });
}

