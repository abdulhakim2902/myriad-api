import {
  globalInterceptor,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ControllerType, MethodType, PlatformType} from '../enums';
import {CurrencyRepository, TransactionRepository} from '../repositories';
import {CurrencyService, TagService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@globalInterceptor('', {tags: {name: 'InitialCreation'}})
export class InitialCreationInterceptor implements Provider<Interceptor> {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(TagService)
    protected tagService: TagService,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this);
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const methodName = invocationCtx.methodName;
    const className = invocationCtx.targetClass.name as ControllerType;

    switch (methodName) {
      case MethodType.CREATE: {
        invocationCtx.args[0].createdAt = new Date().toString();
        invocationCtx.args[0].updatedAt = new Date().toString();

        if (className === ControllerType.USER) {
          invocationCtx.args[0].bio = `Hello, my name is ${invocationCtx.args[0].name}!`;
          break;
        }

        if (className === ControllerType.TRANSACTION) {
          invocationCtx.args[0].currencyId = invocationCtx.args[0].currencyId.toUpperCase();
          await this.currencyRepository.findById(invocationCtx.args[0].currencyId);
          await this.transactionRepository.findById(invocationCtx.args[0].from);
          break;
        }

        if (className === ControllerType.POST) {
          invocationCtx.args[0].platform = PlatformType.MYRIAD;
          if (!invocationCtx.args[0].originCreatedAt)
            invocationCtx.args[0].originCreatedAt = new Date().toString();
        }

        break;
      }

      case MethodType.UPDATEBYID:
        invocationCtx.args[0].updatedAt = new Date().toString;
        break;
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    switch (methodName) {
      case MethodType.CREATE: {
        if (className === ControllerType.USER) {
          this.currencyService.defaultCurrency(result.id) as Promise<void>;
          this.currencyService.defaultAcalaTips(result.id) as Promise<void>;
          break;
        }

        if (className === ControllerType.TRANSACTION) {
          this.currencyService.sendMyriadReward(result.from) as Promise<void>;
          break;
        }

        if (className === ControllerType.POST) {
          if (result.tags.length > 0) {
            this.tagService.createTags(result.tags) as Promise<void>;
          }
          break;
        }

        break;
      }

      case MethodType.VERIFY: {
        this.currencyService.claimTips(result) as Promise<void>;
        break;
      }
    }

    return result;
  }
}
