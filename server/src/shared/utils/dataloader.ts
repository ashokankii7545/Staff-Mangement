import DataLoader from 'dataloader';
import { UserModel, IUserDocument } from '../../modules/user/user.model.js';
import { OfficeModel, type OfficeDocument } from '../../modules/office/office.model.js';

export interface DataLoaders {
  userLoader: DataLoader<string, IUserDocument | null>;
  officeLoader: DataLoader<string, OfficeDocument | null>;
}

export function createDataLoaders(): DataLoaders {
  return {
    userLoader: new DataLoader<string, IUserDocument | null>(async (keys) => {
      const users = await UserModel.find({ _id: { $in: keys } });
      const userMap = new Map(users.map((u) => [String(u._id), u]));
      return keys.map((key) => userMap.get(String(key)) || null);
    }),
    
    officeLoader: new DataLoader<string, OfficeDocument | null>(async (keys) => {
      const offices = await OfficeModel.find({ _id: { $in: keys } });
      const officeMap = new Map(offices.map((o) => [String(o._id), o]));
      return keys.map((key) => officeMap.get(String(key)) || null);
    })
  };
}
