const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const mailgun = require("mailgun-js");
const DOMAIN = 'sandboxcc03846c33184ffc9b7784770cf693a7.mailgun.org';
const mg = mailgun({ apiKey: process.env.MAILGUN_APIKEY, domain: DOMAIN });


//midlleware
app.use(express.json());
app.use(cors());

//database connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ng69xjx.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



app.get('/', (req, res) => {
    res.send(`server is running`);
})


async function run() {
    try {
        //collections
        const usersCollection = client.db('socialGroup').collection('Users');
        const postCollection = client.db('socialGroup').collection('posts');

        //add users to database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const email = user.email;
            const query = {
                email: email
            }
            const savedUser = await usersCollection.findOne(query);
            if (!savedUser) {
                const result = await usersCollection.insertOne(user);
                return res.send(result);
            }
            res.send({ message: 'User already exists' })
        })

        //check user info to login
        app.post('/userlogin', async (req, res) => {
            const user = req.body;
            const email = user.email;
            const query = {
                email: email
            }
            const savedUser = await usersCollection.findOne(query);
            if (!savedUser) {
                return res.send({ message: 'User not found! Please signup first!' });
            }
            res.send({ message: 'logged in successfully' })
        })

        //forget password api
        app.put('/forget-password', async (req, res) => {

            const email = req.body.email;
            console.log(email);

            const query = {
                email: email
            }

            const user = await usersCollection.findOne(query);
            console.log(user);

            if (!user) {
                return res.status(400).send({ message: 'user with this email does not exist' })
            }

            const token = jwt.sign({ _id: user._id }, process.env.RESET_PASS_KEY, { expiresIn: '20m' })

            const data = {
                from: 'noreply@hello.com',
                to: email,
                subject: 'Password reset link',
                html: `
                <h2>Please click on the link to reset password</h2>
                <p>${process.env.CLIENT_URL}/reset/${token}</p>
                `
            }

            const updatedDoc = {
                $set: {
                    resetLink: token
                }
            };
            const options = { upsert: true }
            const update = await usersCollection.updateOne(query, updatedDoc, options);
            console.log(update);
            if (update.modifiedCount > 0) {
                mg.messages().send(data, function (error, body) {
                    if (error) {
                        return res.send({
                            error: error.message
                        })
                    }
                    return res.send({ message: 'reset link sent in mail. please follow the instructions' })
                });
            }

        })

        //CRUD operations for social media post

        //Read
        app.get('/posts', async (req, res) => {
            const query = {

            };
            const post = await postCollection.find(query).toArray();
            res.send(post);
        })

        //Create 
        app.post('/posts', async (req, res) => {
            const post = req.body;
            const result = await postCollection.insertOne(post);
            if (result.acknowledged) {
                return res.status(200).send({ message: 'posted successfully' })
            }
            else {
                return res.status(401).send({ message: "could not post" })
            }
        })

        //update posts
        app.put('/posts/:id', async (req, res) => {
            const post = req.body;
            const id = req.params.id;
            const filter = {
                _id: ObjectId(id)
            }
            const updateDoc = {
                $set: {
                    description: post.description
                }
            }
            const options = { upsert: true };
            const result = await postCollection.updateOne(filter, updateDoc, options);
            if (result.modifiedCount > 0) {
                return res.status(200).send({ message: 'post updated successfully' })
            }
            else {
                return res.status(401).send({ message: "could not update post" })
            }
        })

        app.delete('/posts/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: ObjectId(id)
            }
            const result = await postCollection.deleteOne(filter);
            if (result.deletedCount > 0) {
                return res.status(200).send({ message: 'post deleted successfully' })
            }
            else {
                return res.status(401).send({ message: "could not delete post" })
            }
        })

        //Like status update api

        app.put('/like/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: ObjectId(id)
            }
            const updatedDoc = {
                $set: {
                    likeStatus: "true"
                }
            }
            const options = { upsert: true }
            const result = await postCollection.updateOne(query, updatedDoc, options);
            if (result.modifiedCount > 0) {
                return res.status(200).send({ message: 'Like status updated successfully' })
            }
            else {
                return res.status(401).send({ message: "could not update like status" })
            }
        })

        //add a comment 
        app.put('/comment/:id', async (req, res) => {
            const id = req.params.id;
            const comment = req.body.comment;
            const query = {
                _id: ObjectId(id)
            }

            const post = await postCollection.findOne(query);
            let updatedDoc = {};
            if (post.comments) {
                post.comments.push(comment);
                updatedDoc = {
                    $set: {
                        comments: post.comments
                    }
                }
            }
            else {
                updatedDoc = {
                    $set: {
                        comments: [comment]
                    }
                }
            }
            const options = { upsert: true }
            const result = await postCollection.updateOne(query, updatedDoc, options);
            if (result.modifiedCount > 0) {
                return res.status(200).send({ message: 'comment added successfully' })
            }
            else {
                return res.status(401).send({ message: "could not comment" })
            }
        })

    }
    finally {

    }
}
run().catch(console.log())



app.listen(port, () => {
    console.log(`server running on ${port}`);
})