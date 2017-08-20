//requiring all used modules, initializing express
const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const session = require('express-session');//creeert sessie vd user, zonder dit geen login en out. user authentication 

//configuring and initializing modules
const app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/../public'));
app.use(bodyParser.urlencoded({ extended: true }));//bepaalde type data die niet worden gelezen bij false
//const sequelize = new Sequelize('blog', process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
const sequelize = new Sequelize('blog_application','postgres','postgres', {//database blog aanmaken....
  host: 'localhost',
  dialect: 'postgres',
});
app.use(session({
  secret: "such secret, many wows",
  saveUninitialized: true,//voor users die vh eerst op de website komen
  resave: false//voor users die al wel een account hebben en checkt of ze cookie hebben met open sessie. met false wordt server niet uitgelogd
}));

//model definition
//users have a one-to-many relationship with both posts and comments
const User = sequelize.define('users', {//table model is met hoofdletter...
  username: {
    type: Sequelize.STRING,
    unique: true
  },
  email: {
    type: Sequelize.STRING,
    unique: true
  },
  password: {
    type: Sequelize.STRING
  }
}, {
  timestamps: false//Let op suntex, hoort niet bovenstaande keys. als dit niet specifiek wordt opgenoemd, dan genereert sequelize auto 2 columns.
});

//posts have a many-to-one relationship with users and a one-to-many relationship with comments
const Posts = sequelize.define('posts', {
  title: {
    type: Sequelize.STRING,
  },
  body: {
    type: Sequelize.TEXT
  }
}, {
  timestamps: false
});

//comments have a many-to-one relationship with users and with posts
const Comments = sequelize.define('comments', {
  body: {
    type: Sequelize.TEXT
  }
}, {
  timestamps: false
});

User.hasMany(Posts);
User.hasMany(Comments);
Posts.hasMany(Comments);
Posts.belongsTo(User);
Comments.belongsTo(User);
Comments.belongsTo(Posts);

//syncing models
sequelize.sync({force:false});//{ force:true }// 1e x moet je op true zetten omdat geen tabellen in de database zitten. Wel eerst databse aanmaken anders doet i het niet.  

//Routing, login form is on index page
app.get('/', (req, res) => {
  res.render('index', {
    //met reg.query kan je de parameter renderen (regel 112). Data naar PUG altijd als object meesturen. 
    //user verwijst naar regel 22 in indexpug-file
    user: req.session.user//om te kijken of een user ingelogd is of niet. object waar een key inzit, console.log (req.session)

  });
});

app.get('/register', (req,res) => {
  res.render('register');
})

//creating new user in database and starting session for the user and sending them to their profile
app.post('/register', (req,res) => {//pugfile form register verwijst naar deze post route
  User.create({//insert into users 'values'//creeert nieuwe rijen voor users
    username: req.body.username,//username van inputvelden in pugfile/html en in model
    email: req.body.email,
    password: req.body.password
  })
  .then((user) => {//user is alle data van de vorige stap...
    req.session.user = user;//zodra user is gecreeert wordt de req.session.user de user di zojuist is gemaakt
    res.redirect(`/users/${user.username}`)//babel gebruiken om backticks te kunnen lezen...om een variabele in een string te plaatsten hebben we es6 nodig
  })
});

//go to the user profile page with dynamic route, it will show the user's username
app.get('/users/:username', (req,res) => {//Dynamic routing. username regel 98 wordt vervangen door username in regel 93 u 
  const user = req.session.user;
  if (user === undefined) {//als er nooit eerder ingelogd, redirect naar /. Dus kan geen copy paste URL en dan plakken in andere computer.. 
    res.redirect('/?message=' + encodeURIComponent("Please log in"));//?Redirect naar de homepaginaroute als user is onbekend,met message erachter. Alleen als je parameter in de URL wilt meegeven, anders kan je comp het niet lezen%% in de URL....
  } else {
    res.render('profile', {
      user: user// je stuurt req.session.user mee uit regel 99. 
    })
  }
});

//login with user verification
app.post('/login', (req, res) => {
  if (req.body.username.length === 0) {
    res.redirect('/?message=' + encodeURIComponent("Please fill in your username."))
    return;                                                //checking if user has filled in both fields
  }
  if (req.body.password.length === 0) {
    res.redirect('/?message=' + encodeURIComponent("Please fill in your password."))
    return;
  }
  const username = req.body.username;
  const password = req.body.password;

  User.findOne({//sequelize tutorials checken
    where: {
      username: req.body.username //verifying if user exists
    }
  })
  .then((user) => {
    if (user !== null && password === user.password) {//wachtwoord check
      req.session.user = user;//als het klopt dan onderstaand....
      res.redirect(`/users/${user.username}`);          //if they exist and info is correct, start session for user
    } else {
      res.redirect('/?message=' + encodeURIComponent("Invalid email or password.")); //if incorrect showing error to user
    }
  })
  .catch((error) => {//promises als er een err zit in bovenstaande dan catch err....
    console.error(error);           //if any error occurs showing an invalid message to user
    res.redirect('/?message=' + encodeURIComponent("Invalid email or password."));
  });
});

app.get('/logout', (req, res) =>{
	req.session.destroy(function(error) {    //logging out user and destorying session
		if(error) {
			throw error;
		}
		res.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
	})
});

app.get('/posts', (req, res)=> {
  const user = req.session.user;
  if (user === undefined) {           //checking if user is logged in
    res.redirect('/?message=' + encodeURIComponent("Please log in"));
  } else {
      User.findAll()                    //finding all users and posts in the database, rendering all across to pug file
      .then((users) => {
        Posts.findAll()
        .then((allPosts) => {
          res.render('allposts', {
            postList: allPosts,//sequalize n promises
            user: user,
            users: users
          })
        })
      .catch((error) => {
          console.error(error);
      });
    })

  };
});


app.post('/posts/new', (req, res) => {
  const user = req.session.user.username;
  const title = req.body.title;
  const body = req.body.body;
  const userId = req.session.user.id;
  User.findOne({
    where: {username: user}           //making sure current user is referenced, attaching logged in user's data to post being created
  })
  .then((user) => {
    return user.createPost({
      title: title,                 //creating a post with current user info attached
      body: body,
      userId: userId
    })
  })
  .then((post) => {
    res.redirect('/posts');
  })
  .catch((error) => {
      console.error(error);
  });
});

app.get('/posts/user', (req, res) => {
  const user = req.session.user;
  const userID = req.session.user.id;
  Posts.findAll({
    where: {
      userId: userID                //finding posts with current logged in user attached, aka the ones the current user posted
    }
  })
  .then((myPosts) => {
    res.render('userposts', {     //then rendering them across to the pug file
      userPosts: myPosts,
      user: user
    })
  })
  .catch((error) => {
      console.error(error);
  });
});

app.get('/posts/:postId', function(req, res){
	//const postId = req.params.postId;
  const postId = req.params.postId;
  const user = req.session.user;        //creating page for each individual post
	if (user === undefined) {           //checking if user is logged in
        res.redirect('/?message=' + encodeURIComponent("Please log in."));
  } else {
    User.findAll()
    .then((users) => {
      Posts.findOne({
        where: {
          id: postId  
          // id: postId          //finding all users and posts, including comments in the posts
        },
        include: [{
          model: Comments,
          as: 'comments'
        }]
      })
      .then(function(post){     //then rendering them across to the pug file
        console.log(post);
    		res.render("post", {post: post, postId: postId, users: users});
    	})
      .catch((error) => {
        console.error(error);
      });
    });
  };
});

app.post('/comments', (req, res) => {
  const user = req.session.user;            //for creating a new comment
  const commentText = req.body.body;
  const postComment = req.body.postid;
  // const postComment = req.body.postId;
  if (user === undefined) {           //checking if user is logged in
    res.redirect('/?message=' + encodeURIComponent("Please log in"));
  } else {
    User.findOne({
      where: {username: user.username}    //attaching logged in user's data to comment being created
    })
    .then((user) => {
      return user.createComment({
        body: commentText,
        user: user,
        postId: postComment
      });
    })
    .then((userComment) => {
      console.log(userComment.body);
      res.redirect(`/posts/${req.body.postid}`);
      //res.redirect(`/posts/${req.body.postId}`);
    });
  };
});

const server = app.listen(3001, () => {
  console.log('Example app listening on port: ' + server.address().port);
})
