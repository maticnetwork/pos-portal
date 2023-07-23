import { promiseResolve } from "./promise_resolve";

export interface IMapPromiseOption {
  concurrency: number;
}

const runPromises = (promises: Array<Promise<any>>, converter: Function) => {
  const maps = promises.map((val, index) => {
    return converter(val, index);
  });
  return Promise.all(maps);
};

export function mapPromise(
  values: any[],
  converter: Function,
  option: IMapPromiseOption = {} as any
) {
  const valuesLength = values.length;
  const concurrency = option.concurrency || valuesLength;

  let result: any = [];
  const limitPromiseRun: () => Promise<any> = () => {
    const promises = values.splice(0, concurrency);
    return runPromises(promises, converter).then((promiseResult) => {
      result = result.concat(promiseResult);

      return valuesLength > result.length
        ? limitPromiseRun()
        : promiseResolve(result);
    });
  };

  return limitPromiseRun();
}
