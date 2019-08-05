import { Op } from 'sequelize';
import Subscription from '../models/Subscription';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';
import Queue from '../../lib/Queue';
import SubscriptionMail from '../jobs/SubscriptionMail';

class SubscriptionController {
  async index(req, res) {
    const subscriptions = await Subscription.findAll({
      where: { user_id: req.userId },
      include: [
        {
          model: Meetup,
          include: [
            User,
            {
              model: File,
              as: 'File',
              attributes: ['id', 'path', 'url'],
            },
          ],
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          required: true,
        },
      ],
      order: [[Meetup, 'date']],
    });

    return res.json(subscriptions);
  }

  async store(req, res) {
    // const
    const meetup = await Meetup.findByPk(req.params.id, {
      include: [User],
    });

    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found.' });
    }

    if (meetup.user_id === req.userId) {
      return res
        .status(400)
        .json({ error: "You can't subscribe to your own meetup." });
    }

    if (meetup.past) {
      return res
        .status(400)
        .json({ error: "You can't subscribe to a past event." });
    }

    const checkAlreadySubscripted = await Subscription.findOne({
      where: { user_id: req.userId, meetup_id: req.params.id },
    });
    if (checkAlreadySubscripted) {
      return res
        .status(400)
        .json({ error: "You can't subscribe twice to an event." });
    }

    const subscription = await Subscription.create({
      user_id: req.userId,
      meetup_id: req.params.id,
    });

    const user = await User.findByPk(req.userId);
    await Queue.add(SubscriptionMail.key, {
      meetup,
      user,
    });

    return res.json(subscription);
  }

  async delete(req, res) {
    const subscription = await Subscription.findByPk(req.params.id, {
      include: [Meetup],
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Not found.' });
    }

    if (subscription.user_id !== req.userId) {
      return res.status(401).json({ error: 'Not authorized.' });
    }

    if (subscription.Meetup.past) {
      return res.status(400).json({ error: "Can't delete past subscription." });
    }

    await subscription.destroy();

    return res.send();
  }
}

export default new SubscriptionController();
