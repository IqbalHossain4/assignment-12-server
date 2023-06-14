const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_TOKEN);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


//verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.axpgb1h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const users = client.db("sky").collection("user");
    const topClass = client.db("sky").collection("topClass");
    const instructor = client.db("sky").collection("instructor");
    const allSports = client.db("sky").collection("allsports");
    const selectedClass = client.db("sky").collection("selectedClass");
    const paymentCollection = client.db("sky").collection("payment");

    //jwt post
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await users.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await users.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //user get
    app.get(
      "/users",
      verifyJWT,
      verifyAdmin,
      verifyInstructor,
      async (req, res) => {
        const result = await users.find().toArray();
        res.send(result);
      }
    );

    app.get("/user", async (req, res) => {
      const query = req.query;
      const result = await users.findOne(query);
      res.send(result);
    });

    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await users.findOne(query);
      res.send(result);
    });

    //instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // verify email
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await users.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    //admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // verify email
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await users.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.get("/alluser", async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });
    //get classes
    app.post("/topclass", async (req, res) => {
      const item = req.body;
      const result = await topClass.insertOne(item);
      res.send(result);
    });

    //post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await users.findOne(query);
      if (existingUser) {
        return res.send({ message: "already exist" });
      }
      const result = await users.insertOne(user);
      res.send(result);
    });
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateUser = req.body;
      const updateDocs = {
        $set: {
          role: updateUser.role,
        },
      };
      const result = await users.updateOne(query, updateDocs);
      res.send(result);
    });

    //class
    app.get("/topclass", async (req, res) => {
      const result = await topClass
        .find()
        .sort({ student_number: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/topclass/email", async (req, res) => {
      const user = req.query.email;
      const query = { email: user };
      const result = await topClass.find(query).toArray();
      res.send(result);
    });

    app.get("/topclass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await topClass.findOne(query);
      res.send(result);
    });

    app.put("/topclass/:id", async (req, res) => {
      const id = req.params.id;
      const user = req.body;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedClass = {
        $set: {
          sport_name: user.sport_name,
          available_seats: user.available_seats,
          price: user.price,
          picture: user.picture,
        },
      };
      const result = await topClass.updateOne(filter, updatedClass, option);
      res.send(result);
    });

    app.patch("/topclass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateStatus = req.body;
      const updateDoc = {
        $set: {
          status: updateStatus?.status,
          feedBack: updateStatus?.feedBack,
        },
      };
      const result = await topClass.updateOne(query, updateDoc);
      res.send(result);
    });

    //get instructor
    app.get("/instructors", async (req, res) => {
      const result = await instructor.find().sort({ students: -1 }).toArray();
      res.send(result);
    });

    //get sports
    app.get("/allsports", async (req, res) => {
      const result = await allSports.find().toArray();
      res.send(result);
    });

    //selected Class

    app.post("/selectCourse", async (req, res) => {
      const item = req.body;
      const result = await selectedClass.insertOne(item);
      res.send(result);
    });

    app.get("/selectCourse", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await selectedClass.find(query).toArray();
      res.send(result);
    });

    app.delete("/selectCourse/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClass.deleteOne(query);
      res.send(result);
    });
    //payment
    app.post("/create-payment", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //payments post

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItem.map((id) => new ObjectId(id)) },
      };
      const deleteRsult = await topClass.deleteMany(query);
      res.send(result,deleteRsult);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("HELLO Word");
});
app.listen(port, () => {
  console.log(`server running ${port}`);
});
