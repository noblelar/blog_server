const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });
const app = express();

const salt = bcrypt.genSaltSync(10);
const secret = 'sleo';

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(process.env.MONGO_URL);

// mongoose.connect('mongodb+srv://noble1:oGyFlsXmPBcf5bmw@cluster0.9ubiesn.mongodb.net/?retryWrites=true&w=majority');

app.get('/', async (req, res) => {
    res.json('this is awesome');
})

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt),
        });
        res.json(userDoc);
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
        //logged in
        jwt.sign({ username, id: userDoc.id }, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                id: userDoc.id,
                username,
            });
            // res.json(token);
        });
    } else {
        // not logged in
        res.status(400).json('wrong credential');
    }

});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    })
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
})

app.post('/post', upload.single('files'), async (req, res) => {
    const { originalname, path, } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;

    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id,
        });
        res.json(postDoc);
    })

    // res.json({ ext });
    // res.json({ file: req.file });

})

// ! Updating posts

app.put('/post', upload.single('files'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path, } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;

        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        // res.json({ isAuthor, postDoc, info });
        if (!isAuthor) {
            return res.status(400).json('You are not the author');
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });
        res.json(postDoc);
    });


});


app.get('/post', async (req, res) => {
    res.json(
        await Post.find()
            .populate('author', ["username"])
            .sort({ createdAt: -1 })
            .limit(20)
    );
});

app.get(`/post/:id`, async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
    // res.json(req.params);
});



app.listen(4000);




// oGyFlsXmPBcf5bmw
// mongodb+srv://noble1:oGyFlsXmPBcf5bmw@cluster0.9ubiesn.mongodb.net/?retryWrites=true&w=majority


