import { Op } from 'sequelize';

import Meetup from '../models/Meetup';

class OrganizerController {
  async index(req, res) {
    const meetups = await Meetup.findAll({
      where: {
        user_id: req.userId,
        date: {
          [Op.gt]: new Date(),
        },
      },
      order: ['date'],
    });

    return res.json(meetups);
  }
}

export default new OrganizerController();
