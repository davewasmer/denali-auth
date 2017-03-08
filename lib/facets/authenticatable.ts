import { createMixin, eachPrototype, Errors } from 'denali';
import createDebug from 'debug';
import { reject } from 'bluebird';
import upperFirst from 'lodash/upperFirst';

const debug = createDebug('denali-auth:authenticatable');

export default createMixin((MixinBase) => {
  return class AuthenticatableMixin extends MixinBase {

    static isAuthenticatable = true;

    static async authenticate(action, params, allowedStrategies) {
      let failureReason;
      let attemptNextStrategy = async (strategies) => {
        let strategy = strategies.shift();
        if (!strategy) {
          return reject(failureReason);
        }
        if (allowedStrategies !== 'all' && !allowedStrategies.includes(strategy.strategyName)) {
          return attemptNextStrategy(strategies);
        }
        let currentUser;
        try {
          currentUser = await strategy.authenticateRequest(action, params, this);
        } catch (error) {
          debug(`${ strategy.strategyName } failed with "${ error.message }", ${ strategies.length } strategies remaining`);
          failureReason = failureReason || error;
          return attemptNextStrategy(strategies);
        }
        if (!currentUser) {
          throw new Error(`${ strategy.strategyName }.authenticateRequest() should have returned the current user or errored, but instead it returned ${ currentUser }`);
        }
        debug(`${ strategy.strategyName } succeeded, request is authenticated`);
        return currentUser;
      };

      if (!this._strategies) {
        this._strategies = [];
        eachPrototype(this, (mixin) => {
          if (mixin.hasOwnProperty('authenticateRequest')) {
            this._strategies.push(mixin);
          }
        });
      }

      if (this._strategies.length === 0) {
        throw new Errors.InternalServerError(`You tried to authenticate with a ${ upperFirst(this.type) } model, but you haven't applied any authentication mixins (i.e. passwordable, oauthable, sessionable).`);
      }

      let strategies = this._strategies.filter(({ strategyName }) => {
        return allowedStrategies === 'all' || allowedStrategies.includes(strategyName);
      });

      if (strategies.length === 0) {
        throw new Errors.InternalServerError(`None of the available authentication strategies for this user model are allowed on this action, so authentication is impossible. You must allow at least one strategy, or remove the authenticate filter entirely. Available strategies are: ${ this._strategies.map((s) => s.strategyName) }, and allowed stratgies are: ${ allowedStrategies }`);
      }

      debug(`[${ action.request.id }]: attempting to authenticate with: ${ strategies.map((s) => s.strategyName).join(', ') }`);
      return attemptNextStrategy(this._strategies.slice(0));
    }

  };
});
