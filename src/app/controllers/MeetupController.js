import { Op } from 'sequelize';
import { isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';

import Meetup from '../models/Meetup';
import User from '../models/User';
import Subscription from '../models/Subscription';
import File from '../models/File';

class MeetupController {
  async index(req, res) {
    const { page = 1, date } = req.query;
    const where = {};

    if (date) {
      const searchDate = parseISO(date);

      where.date = {
        [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
      };
    }

    const meetups = await Meetup.findAndCountAll({
      where,
      include: [
        {
          model: Subscription,
          as: 'subscription',
          attributes: ['user_id'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
        {
          model: File,
          as: 'banner',
          attributes: ['name', 'path', 'url'],
        },
      ],
      limit: 2,
      offset: (page - 1) * 2,
    });

    res.setHeader('x-total-count', meetups.count);

    return res.json(meetups.rows);
  }

  async store(req, res) {
    const { date } = req.body;

    if (isBefore(parseISO(date), new Date())) {
      return res
        .status(400)
        .json({ error: 'Não é possível criar um meetup com data passada' });
    }

    const meetup = await Meetup.create({
      ...req.body,
      user_id: req.userId,
    });

    return res.json(meetup);
  }

  async update(req, res) {
    const user_id = req.userId;

    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(401).json({ error: 'Meetup não encontrado' });
    }

    if (meetup.user_id !== user_id) {
      return res.status(401).json({ error: 'Usuário não autorizado' });
    }

    if (isBefore(parseISO(req.body.date), new Date()) || meetup.past) {
      return res
        .status(400)
        .json({ error: 'Não é possível atualizar um meetup com data passada' });
    }

    await meetup.update(req.body);

    return res.json(meetup);
  }

  async delete(req, res) {
    const user_id = req.userId;

    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(401).json({ error: 'Meetup não encontrado' });
    }

    if (meetup.user_id !== user_id) {
      return res.status(401).json({ error: 'Usuário não autorizado' });
    }

    if (meetup.past) {
      return res
        .status(400)
        .json({ error: 'Não é possível apagar um meetup já realizado' });
    }

    await meetup.destroy();

    return res.send();
  }
}

export default new MeetupController();
