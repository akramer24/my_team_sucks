const {Collections, Sports} = require("../enums");
const initializeFirebaseAdmin = require("../initializeFirebaseAdmin");

class Seeder {
  constructor(firestore) {
    if (firestore) {
      this.firestore = firestore;
    } else {
      const admin = initializeFirebaseAdmin();
      this.firestore = admin.firestore();
    }
  }

  async seedTeams() {
    const teams = require("./dummyTeams.json");

    try {
      for (const [id, data] of Object.entries(teams)) {
        await this.firestore
            .collection(Collections.SPORT)
            .doc(Sports.BASE)
            .collection(Collections.YEAR)
            .doc("2022")
            .collection(Collections.TEAMS)
            .doc(id)
            .set(data);
      }
    } catch (err) {
      console.log("Could not seed teams", err);
    }
  }
}

module.exports = {Seeder};
