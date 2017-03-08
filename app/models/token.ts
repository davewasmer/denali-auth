import { Model, attr } from 'denali';
import assert from 'assert';
import uuid from 'node-uuid';

export default class Token extends Model {

  static abstract = true;

  static userId = attr('text');
  static userType = attr('text');
  static token = attr('text');
  static expiresAt = attr('date');

  async getUser() {
    let User = this.modelFor(this.userType);
    let user = await User.findOne(this.userId);
    assert(user, `Corrupted ${ this.constructor.type } token! Associated user not found (id: ${ this.userId }).`);
    return user;
  }

  save() {
    assert(this.userType, `You must supply a userType when creating a ${ this.constructor.type }`);
    if (!this.token) {
      this.token = uuid();
    }
    return super.save(...arguments);
  }

}
