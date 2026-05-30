function lengthOfLIS(nums) {
    if (nums.length === 0) return 0;
    let dp = new Array(nums.length).fill(1);
    for (let i = 1; i < nums.length; i++) {
        for (let j = 0; j < i; j++) {
            if (nums[i] > nums[j]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
    }
    return Math.max(...dp);
}

try {
    const result = lengthOfLIS([10,22,9,33,21,50,41,60,80]);
    console.log(JSON.stringify(result));
} catch (error) {
    console.error('ERROR: ' + error.message);
    process.exit(1);
}
