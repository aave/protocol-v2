using LendingPoolHarnessForVariableDebtToken as POOL
/**
TotalSupply is the sum of all users’ balances
	
totalSupply(t) = Σaddress u. balanceOf(u,t)

Check that each possible opertaion changes the balance of at most one user
*/
rule balanceOfChange(address a, address b, method f)
{
	env e;
	require a!=b ;
	uint256 balanceABefore = sinvoke balanceOf(e, a);
	uint256 balanceBBefore = sinvoke balanceOf(e, b);
	 
	calldataarg arg;
	sinvoke f(e, arg); 

	uint256 balanceAAfter = sinvoke balanceOf(e, a);
	uint256 balanceBAfter = sinvoke balanceOf(e, b);
	
	assert ( balanceABefore == balanceAAfter || balanceBBefore == balanceBAfter );
}

/*
Check that the changed to total supply is coherent with the changes to balance
*/

rule integirtyBalanceOfTotalSupply(address a, method f )
{
	env e;
	
	uint256 balanceABefore = balanceOf(e, a);
	uint256 totalSupplyBefore = totalSupply(e);
	 
	calldataarg arg;
	sinvoke f(e, arg); 
	require (f.selector != burn(address, uint256, uint256).selector  &&
		f.selector != mint(address, uint256, uint256).selector ) ;
	uint256 balanceAAfter = balanceOf(e, a);
	uint256 totalSupplyAfter = totalSupply(e);

	assert  (balanceAAfter != balanceABefore  => ( balanceAAfter - balanceABefore  == totalSupplyAfter - totalSupplyBefore));
}

/* Burn behaves deferently and due to accumulation errors might hace less total supply then the balance
*/

rule integirtyBalanceOfTotalSupplyOnBurn(address a, method f )
{
	env e;
	
	uint256 balanceABefore = balanceOf(e, a);
	uint256 totalSupplyBefore = totalSupply(e);
	 
	uint256 x;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	sinvoke burn(e, a, x, index); 
	uint256 balanceAAfter = balanceOf(e, a);
	uint256 totalSupplyAfter = totalSupply(e);
	assert  (balanceAAfter != balanceABefore  => ( balanceAAfter - balanceABefore  == totalSupplyAfter - totalSupplyBefore));
}

rule integirtyBalanceOfTotalSupplyOnMint(address a, method f )
{
	env e;
	
	uint256 balanceABefore = balanceOf(e, a);
	uint256 totalSupplyBefore = totalSupply(e);
	 
	uint256 x;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	sinvoke mint(e, a, x, index); 
	uint256 balanceAAfter = balanceOf(e, a);
	uint256 totalSupplyAfter = totalSupply(e);
	assert  (balanceAAfter != balanceABefore  => ( balanceAAfter - balanceABefore  == totalSupplyAfter - totalSupplyBefore));
}

/**
Minting an amount of x tokens for user u increases their balance by x, up to rounding errors. 
{ b= balanceOf(u,t) } 
mint(u,x,index) 
{ balanceOf(u,t) = b + x }

*/
rule integrityMint(address a, uint256 x) {
	env e;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e,asset);
	uint256 balancebefore = balanceOf(e, a);
	sinvoke mint(e, a, x, index);
	
	uint256 balanceAfter = balanceOf(e, a);
	assert balanceAfter == balancebefore+x;
}

/**
Mint is additive, can performed either all at once or gradually
mint(u,x); mint(u,y) ~ mint(u,x+y) at the same timestamp
*/
rule additiveMint(address a, uint256 x, uint256 y) {
	env e;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	storage initialStorage = lastStorage;
	sinvoke mint(e, a, x, index);
	sinvoke mint(e, a, y, index);
	uint256 balanceScenario1 = balanceOf(e, a);
	uint t = x + y;
	sinvoke mint(e, a, t ,index) at initialStorage;

	uint256 balanceScenario2 = balanceOf(e, a);
	assert balanceScenario1 == balanceScenario2, "mint is not additive";
}

/** 
Transfer of x amount of tokens from user u  where receiver is user u’
{bu = balanceOf(u) } 
	burn(u, u’, x)
{balanceOf(u) = bu - x } 
*/
rule integrityBurn(address a, uint256 x) {
	env e;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	uint256 balancebefore = balanceOf(e, a);
	sinvoke burn(e, a, x, index);
	
	uint256 balanceAfter = balanceOf(e, a);
	assert balanceAfter == balancebefore - x;
}
/**
Minting is additive, i.e., it can be performed either all at once or in steps.

burn(u, u’, x); burn(u, u’, y) ~ burn(u, u’, x+y) 
*/
rule additiveBurn(address a, uint256 x,  uint256 y) {
	env e;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	storage initialStorage = lastStorage;
	sinvoke burn(e, a, x, index);
	sinvoke burn(e, a, y, index);
	uint256 balanceScenario1 = balanceOf(e, a);
	uint t = x + y;
	sinvoke burn(e, a, t ,index) at initialStorage;

	uint256 balanceScenario2 = balanceOf(e, a);
	assert balanceScenario1 == balanceScenario2, "burn is not additive";
}

/**
Minting and burning are inverse operations.

{bu = balanceOf(u) } 
mint(u,x); burn(u, u, x) 
	{balanceOf(u) = bu } 
*/
rule inverseMintBurn(address a, uint256 x) {
	env e;
	address asset;
	uint256 index = POOL.getReserveNormalizedVariableDebt(e, asset);
	uint256 balancebefore = balanceOf(e, a);
	sinvoke mint(e, a, x, index);
	sinvoke burn(e, a, x, index);
	uint256 balanceAfter =  balanceOf(e, a);
	assert balancebefore == balanceAfter, "burn is not inverse of mint";
}



