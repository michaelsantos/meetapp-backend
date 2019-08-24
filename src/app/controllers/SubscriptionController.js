import { Op } from 'sequelize';

import User from '../models/User';
import Meetup from '../models/Meetup';
import Subscription from '../models/Subscription';
import File from '../models/File';

import Queue from '../../lib/Queue';
import SubscriptionMail from '../jobs/SubscriptionMail';

class SubscriptionController {
  async index(req, res) {
    const subscriptions = await Subscription.findAndCountAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          include: [
            {
              model: File,
              as: 'banner',
              attributes: ['name', 'path', 'url'],
            },
            {
              model: User,
              as: 'user',
              attributes: ['name', 'email'],
            },
          ],
        },
      ],
      order: [['meetup', 'date']],
    });

    res.setHeader('x-total-count', subscriptions.count);

    return res.json(subscriptions.rows);
  }

  async store(req, res) {
    const user = await User.findByPk(req.userId);

    const meetup = await Meetup.findByPk(req.params.meetupId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (!meetup) {
      return res.status(400).json({ error: 'Meetup não encontrado' });
    }

    if (meetup.user_id === req.userId) {
      return res.status(400).json({
        error: 'Não é possível se inscrever em seus próprios meetups',
      });
    }

    if (meetup.past) {
      return res
        .status(400)
        .json({ error: 'Não é possível se inscrever em meetups realizados' });
    }

    const checkDate = await Subscription.findOne({
      where: {
        user_id: user.id,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          required: true,
          where: {
            date: meetup.date,
          },
        },
      ],
    });

    if (checkDate) {
      return res.status(400).json({
        error: 'Não é possível se inscrever em dois meetup ao mesmo tempo',
      });
    }

    const subscription = await Subscription.create({
      user_id: user.id,
      meetup_id: meetup.id,
    });

    await Queue.add(SubscriptionMail.key, {
      meetup,
      user,
    });

    return res.json(subscription);
  }

  async delete(req, res) {
    const user = await User.findByPk(req.userId);

    const meetup = await Meetup.findByPk(req.params.meetupId, {
      include: {
        model: User,
        as: 'user',
        attributes: ['id'],
      },
    });

    if (!meetup) {
      return res.status(400).json({ error: 'Meetup não encontrado' });
    }

    const subscribed = await Subscription.findOne({
      where: {
        user_id: user.id,
        meetup_id: meetup.id,
      },
    });

    if (!subscribed) {
      return res
        .status(401)
        .json({ error: 'Você não está inscrito nesse meetup' });
    }

    if (meetup.past) {
      return res.status(401).json({
        error: 'Não é possível cancelar inscrição de meetups realizados',
      });
    }

    subscribed.destroy();

    return res.send();
  }
}

export default new SubscriptionController();
