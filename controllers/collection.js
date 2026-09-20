const { response } = require('express');
const Collection = require('../models/collection');
const Asset = require('../models/asset');
const { deleteAsset, uploadAsset, publicUrl, cleanCollectionFolder } = require('../middlewares/storage');

const create_collection = async (req, res = response) => {
  try {
    const data = req.body;

    const collection = new Collection({
      ...data,
      banner: {},
    });

    if (req.files?.banner) {
      const file = req.files.banner;
      const folder = `${collection._id}`;
      collection.banner = await uploadAsset(file, folder, 'image');
    }
    let saved;
    try {
      saved = await collection.save();
    } catch (err) {
      if (collection.banner?.public_id) await deleteAsset(collection.banner.public_id);
      throw err;
    }
    return res.json(saved);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: 'El slug ya existe.' });
    }
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const update_collection = async (req, res = response) => {
  try {
    const data = req.body;
    const id = data._id || req.params.id;

    const collection = await Collection.findById(id);
    if (!collection) {
      return res.status(404).json({ msg: 'Collection no encontrada.' });
    }

    const previousBanner = collection.banner;
    if (req.files?.banner) {
      const file = req.files.banner;
      const folder = `${collection._id}`;
      const bannerInfo = await uploadAsset(file, folder, 'image');
      data.banner = bannerInfo;
    }

    Object.assign(collection, data);

    let updated;
    try {
      updated = await collection.save();
    } catch (err) {
      if (req.files?.banner && data.banner?.public_id) await deleteAsset(data.banner.public_id);
      throw err;
    }
    if (req.files?.banner && previousBanner?.public_id) {
      await deleteAsset(previousBanner.public_id);
    }
    return res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: 'El slug ya existe.' });
    }
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const read_collections = async (req, res = response) => {
  try {
    const collections = await Collection.find().sort({ order: 1 });
    return res.json(collections);
  } catch (err) {
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const get_collection = async (req, res = response) => {
  try {
    const id = req.params.id;
    const collection = await Collection.findById(id);
    if (!collection) {
      return res.status(404).json({ msg: 'Collection no encontrada.' });
    }
    return res.json(collection);
  } catch (err) {
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const delete_collection = async (req, res = response) => {
  try {
    const id = req.params.id;

    const assetsCount = await Asset.countDocuments({ collectionId: id });
    if (assetsCount > 0) {
      return res.status(400).json({
        msg: 'Para eliminar esto, primero tienes que eliminar los items de esta galería.',
      });
    }

    const reg = await Collection.findByIdAndDelete(id, { new: true });
    if (!reg) {
      return res.status(404).json({ msg: 'Collection no encontrada.' });
    }

    if (reg?.banner?.public_id) {
      const resourceType = reg.banner?.resource_type || 'image';
      await deleteAsset(reg.banner.public_id, resourceType);
    }
    await cleanCollectionFolder(id);

    return res.json(true);
  } catch (err) {
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const update_collections_order = async (req, res = response) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: 'Items inválidos.' });
    }

    const bulk = items.map((x) => ({
      updateOne: {
        filter: { _id: x._id },
        update: { $set: { order: x.order } },
      },
    }));

    await Collection.bulkWrite(bulk, { ordered: true });

    return res.json({ success: true });
  } catch (err) {
    return res.status(err.status || 500).json({ msg: err?.message });
  }
};

const getResources = async (req, res = response) => {
  try {
    const { gallery } = req.query;

    if (gallery) {
      const collection = await Collection.findOne({ slug: gallery, status: true }).select('title subtitle banner');

      if (!collection) {
        return res.status(404).json({ msg: 'Galería no encontrada' });
      }

      const assets = await Asset.find({ collectionId: collection._id, status: true })
        .sort({ order: 1, _id: 1 })
        .select('title file type order');

      return res.json({
        title: collection.title,
        description: collection.subtitle,
        banner: publicUrl(collection.banner),
        resources: assets.map((a) => ({
          title: a.title || '',
          type: a.type,
          url: publicUrl(a.file),
        })),
      });
    }

    const collections = await Collection.find({ status: true }).sort({ order: 1 }).select('title subtitle slug banner');

    return res.json(
      collections.map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        slug: item.slug,
        image: publicUrl(item.banner),
      })),
    );
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

module.exports = {
  create_collection,
  get_collection,
  read_collections,
  update_collection,
  delete_collection,
  update_collections_order,
  getResources,
};
