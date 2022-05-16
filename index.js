const express = require("express");
const cors = require("cors");
require("dotenv").config();
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

async function run() {
  try {
    await client.connect();
    const serviceCollection = await client
      .db("doctors-portal")
      .collection("service");
    const bookedCollection = await client.db("booked").collection("bookedData");

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const service = await cursor.toArray();
      res.send(service);
    });
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

    // data load for dashboard/myAppointment table
    app.get("/booking", async (req, res) => {
      const query = {};
      const cursor = bookedCollection.find(query);
      const booked = await cursor.toArray();
      res.send(booked);
    });

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
