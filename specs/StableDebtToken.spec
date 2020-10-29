methods {
	getUserLastUpdated(address) returns uint40 envfree
}

rule integrityTimeStamp(address user, method f) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	require getUserLastUpdated(user) <= e.block.timestamp;
	calldataarg arg;
	sinvoke f(e,arg);
	assert getUserLastUpdated(user) <= e.block.timestamp;
}

/**
TotalSupply is the sum of all users’ balances
	
totalSupply(t) = Σaddress u. balanceOf(u,t)

Check that each possible opertaion changes the balance of at most one user
*/
rule balanceOfChange(address a, address b, method f )
{
	env e;
	require a!=b;
	require sinvoke getIncentivesController(e) == 0;
	uint256 balanceABefore = sinvoke balanceOf(e,a);
	uint256 balanceBBefore = sinvoke balanceOf(e,b);
	 
	calldataarg arg;
	sinvoke f(e, arg); 

	uint256 balanceAAfter = sinvoke balanceOf(e,a);
	uint256 balanceBAfter = sinvoke balanceOf(e,b);
	
	assert ( balanceABefore == balanceAAfter || balanceBBefore == balanceBAfter );
}

/**
Check that the change to total supply is coherent with the changes to balance
*/
rule integirtyBalanceOfTotalSupply(address a, method f )
{
	env e;
	require sinvoke getIncentivesController(e) == 0;
	uint256 balanceABefore = sinvoke balanceOf(e,a);
	uint256 totalSupplyBefore = sinvoke totalSupply(e);
	 
	calldataarg arg;
	sinvoke f(e, arg); 
	require (f.selector != burn(address,uint256).selector );
	uint256 balanceAAfter = sinvoke balanceOf(e,a);
	uint256 totalSupplyAfter = sinvoke totalSupply(e);

	assert  (balanceAAfter != balanceABefore  => ( balanceAAfter - balanceABefore  == totalSupplyAfter - totalSupplyBefore));
}

/* Burn behaves differently and due to accumulation errors might have less total supply than the balance
*/
rule integirtyBalanceOfTotalSupplyOnBurn(address a, method f)
{
	env e;
	require sinvoke getIncentivesController(e) == 0;
	uint256 balanceABefore = sinvoke balanceOf(e,a);
	uint256 totalSupplyBefore = sinvoke totalSupply(e);
	 
	uint256 x;
	sinvoke burn(e, a, x); 
	uint256 balanceAAfter = sinvoke balanceOf(e,a);
	uint256 totalSupplyAfter = sinvoke totalSupply(e);
	if (totalSupplyBefore > x)
		assert  (balanceAAfter != balanceABefore  => ( balanceAAfter - balanceABefore  == totalSupplyAfter - totalSupplyBefore));
	else
		assert  (totalSupplyAfter == 0 );
}

/**
Mint inceases the balanceOf user a as expected
*/
rule integrityMint(address a, uint256 x) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	uint256 index;
	uint256 balancebefore = sinvoke balanceOf(e,a);
	sinvoke mint(e,a,x,index);
	
	uint256 balanceAfter = sinvoke balanceOf(e,a);
	assert balanceAfter == balancebefore+x;
}

/**
Mint is additive, can performed either all at once or gradually
mint(u,x); mint(u,y) ~ mint(u,x+y) at the same timestamp

Note: We assume that the stable rate of the user is 0.
The case where the rate is non-zero takes much more time to prove,
and therefore it is currently excluded from the CI.
*/
rule additiveMint(address a, uint256 x, uint256 y) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	require getUserStableRate(e,a) == 0;
	uint256 index;
	storage initialStorage = lastStorage;
	sinvoke mint(e,a,x,index);
	sinvoke mint(e,a,y,index);
	uint256 balanceScenario1 = sinvoke balanceOf(e,a);
	
	uint256 t = x + y;
	sinvoke mint(e,a, t ,index) at initialStorage;
	
	uint256 balanceScenario2 = sinvoke balanceOf(e,a);
	assert balanceScenario1 == balanceScenario2, "mint is not additive";
}

rule integrityBurn(address a, uint256 x) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	uint256 index;
	uint256 balancebefore = sinvoke balanceOf(e,a);
	sinvoke burn(e,a,x);
	
	uint256 balanceAfter = sinvoke balanceOf(e,a);
	assert balanceAfter == balancebefore - x;
}

rule additiveBurn(address a, uint256 x,  uint256 y) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	storage initialStorage = lastStorage;
	sinvoke burn(e, a, x);
	sinvoke burn(e, a, y);
	uint256 balanceScenario1 = balanceOf(e, a);
	uint256 t = x + y;
	sinvoke burn(e, a, t) at initialStorage;

	uint256 balanceScenario2 = balanceOf(e, a);
	assert balanceScenario1 == balanceScenario2, "burn is not additive";
}


/**
mint and burn are inverse operations
Thus, totalSupply is back to initial state
BalanceOf user is back to initial state */
rule inverseMintBurn(address a, uint256 x) {
	env e;
	require sinvoke getIncentivesController(e) == 0;
	uint256 index;
	uint256 balancebefore = sinvoke balanceOf(e,a);
	sinvoke mint(e,a,x,index);
	sinvoke burn(e,a,x);
	uint256 balanceAfter = sinvoke balanceOf(e,a);
	assert balancebefore == balanceAfter, "burn is not inverse of mint";
}

