const express = require("express");
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const {
  MongoClient,
  ServerApiVersion,
  ConnectionCheckedInEvent,
} = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.qgjln.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
const tokenVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "UnAuthorization access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    // all collections
    const serviceCollection = await client
      .db("doctors-portal")
      .collection("service");
    const bookedCollection = await client.db("booked").collection("bookedData");
    const usersCollection = await client.db("booked").collection("users");
    // all api
    // get service load data api
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const service = await cursor.toArray();
      res.send(service);
    });
    // post booking api data
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patientEmail: booking.patientEmail,
      };
      const exists = await bookedCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, exists });
      }
      const result = await bookedCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    // all users api data
    app.get("/users", tokenVerify, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    // data load for dashboard/myAppointment table
    app.get("/booking", tokenVerify, async (req, res) => {
      const patientEmail = req.query.email;
      const query = { patientEmail: patientEmail };
      const authEmail = req.decoded.email;
      if (patientEmail === authEmail) {
        const cursor = bookedCollection.find(query);
        const booked = await cursor.toArray();
        return res.send(booked);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    // filter available api data
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      // get service collection all data
      const services = await serviceCollection.find().toArray();
      // get booking collection all data
      const query = { date: date };
      const bookings = await bookedCollection.find(query).toArray();

      services.forEach((service) => {
        const serviceBooking = bookings.filter(
          (book) => book.treatment === service.name
        );
        const booked = serviceBooking.map((s) => s.slot);
        // service.booked = booked;
        const available = service.slots.filter((s) => !booked.includes(s));
        service.slots = available;
      });
      res.send(services);
    });
    // users api data
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
        expiresIn: "2d",
      });
      const updateDoc = {
        $set: {
          user,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({ result, token: token });
    });
    // secure admin panel
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });
      const isAdmin = result.role === "admin";
      console.log(isAdmin);
      res.send({ admin: isAdmin });
    });
    // make admin api data
    app.put("/user/admin/:email", tokenVerify, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterUser = await usersCollection.findOne({ email: requester });
      const requestAccount = requesterUser.role === "admin";
      if (requestAccount) {
        const user = req.body;
        const filter = { email: email };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        return res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
    /**
     * API Naming Convention
     * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
     * app.get('/booking/:id') // get a specific booking
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id) //
     * app.delete('/booking/:id) //
     */
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World! doctors portal");
});

app.listen(port, () => {
  console.log(`doctors portal app listening on port ${port}`);
});
