import contracts from './contracts'

export const deployFreshRootContracts = async() => {
  const [
    rootChainManager,
    dummyToken,
    dummyStateSender
  ] = await Promise.all([
    contracts.RootChainManager.new(),
    contracts.DummyToken.new(),
    contracts.DummyStateSender.new()
  ])

  return {
    rootChainManager,
    dummyToken,
    dummyStateSender
  }
}

export const deployFreshChildContracts = async() => {
  const [
    childChainManager,
    dummyToken
  ] = await Promise.all([
    contracts.ChildChainManager.new(),
    contracts.ChildToken.new('Dummy Child Token', 'DUMMY', 18)
  ])

  return {
    childChainManager,
    dummyToken
  }
}

export const deployInitializedContracts = async() => {
  const [
    root,
    child
  ] = await Promise.all([
    deployFreshRootContracts(),
    deployFreshChildContracts()
  ])

  await Promise.all([
    root.rootChainManager.setStateSender(root.dummyStateSender.address),
    root.rootChainManager.setChildChainManagerAddress(child.childChainManager.address),
    root.rootChainManager.mapToken(root.dummyToken.address, child.dummyToken.address),
    child.childChainManager.mapToken(root.dummyToken.address, child.dummyToken.address),
    child.dummyToken.setRootToken(root.dummyToken.address)
  ])

  const DEPOSITOR_ROLE = await child.dummyToken.DEPOSITOR_ROLE()
  child.dummyToken.grantRole(DEPOSITOR_ROLE, child.childChainManager.address)

  return { root, child }
}
